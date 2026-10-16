// Direct messages: private 1-on-1 conversations between any two people on Unilink (students, alumni, admins).
//
// A conversation is an ordinary private chat room with two members, plus chat_rooms.dm_key (the two user ids, sorted).
// That way messages, photos and files, deleting your own message, reports and the live updates all work exactly as in
// a room. What is different (enforced in the server, not in the browser):
//   - nobody owns or moderates it: no /commands, no room code, no member list, nobody can edit or delete the room
//   - website admins are NOT members, so they cannot read conversations (a reported message still reaches them)
//   - either person can block the other: nobody can send in that conversation until it is unblocked
//   - new conversations are rate limited
import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './rest.js';
import { visibleRoomSql } from './policies.js';
import { dmKeyFor, hasBlocked } from './dmGuards.js';

const MAX_NEW_PER_HOUR = 20;
const started = new Map(); // user id -> times (ms) of the conversations they started in the last hour

const PEER_SQL = `
  SELECT p.id, p.full_name, p.avatar_url, p.role, p.is_owner, p.is_verified, p.college_role, p.committee_name, c.name AS college_name
    FROM profiles p LEFT JOIN colleges c ON c.id = p.college_id`;

const PREVIEW = { image: 'Photo', video: 'Video', audio: 'Audio', poll: 'Poll' };
const previewOf = (m) => (m.msg_type === 'text' ? String(m.content ?? '').slice(0, 120) : m.msg_type === 'file' ? m.attachment_name || 'File' : PREVIEW[m.msg_type] || 'Message');

/** The conversation `roomId` if it is a direct message this person is part of (and not banned from), else undefined. */
function myConversation(user, roomId) {
  const [sql, params] = visibleRoomSql({ user });
  return db
    .prepare(`SELECT chat_rooms.* FROM chat_rooms JOIN room_members m ON m.room_id = chat_rooms.id AND m.user_id = ? WHERE chat_rooms.id = ? AND chat_rooms.dm_key IS NOT NULL AND ${sql}`)
    .get(user.id, String(roomId ?? ''), ...params);
}

/** POST /api/chat/dm/start { user_id } -> { room_id }. Finds the conversation with that person, or creates it. */
export function startConversation(user, body) {
  const targetId = String(body.user_id ?? '');
  if (!targetId || targetId === user.id) throw new HttpError('Choose someone else to message');
  if (!db.prepare('SELECT 1 FROM profiles WHERE id = ?').get(targetId)) throw new HttpError('That person was not found', 404);
  if (hasBlocked(targetId, user.id)) throw new HttpError("You can't message this person", 403);

  const key = dmKeyFor(user.id, targetId);
  let room = db.prepare('SELECT id FROM chat_rooms WHERE dm_key = ?').get(key);
  if (!room) {
    const now = Date.now();
    const recent = (started.get(user.id) ?? []).filter((t) => now - t < 3600_000);
    if (recent.length >= MAX_NEW_PER_HOUR) throw new HttpError('You have started a lot of new conversations. Please try again later', 429);
    started.set(user.id, [...recent, now]);

    const id = crypto.randomUUID();
    db.exec('BEGIN');
    try {
      db.prepare(`INSERT INTO chat_rooms (id, name, room_type, created_by, dm_key) VALUES (?, 'Direct message', 'private', ?, ?)`).run(id, user.id, key);
      db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(id, user.id);
      db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(id, targetId);
      db.exec('COMMIT');
      room = { id };
    } catch (e) {
      db.exec('ROLLBACK');
      room = db.prepare('SELECT id FROM chat_rooms WHERE dm_key = ?').get(key); // both people started it at the same moment
      if (!room) throw e;
    }
  }
  // Starting a chat again brings back one you deleted (without its old messages).
  db.prepare('UPDATE room_members SET dm_hidden = 0 WHERE room_id = ? AND user_id = ?').run(room.id, user.id);
  return { data: { room_id: room.id } };
}

/** POST /api/chat/dm/delete { room_id }: delete this chat for you only. The other person keeps their copy.
 *  It comes back (empty) if either of you writes again. */
export function deleteConversation(user, body) {
  const room = myConversation(user, body.room_id);
  if (!room) throw new HttpError('Conversation not found', 404);
  const now = new Date().toISOString();
  db.prepare('UPDATE room_members SET cleared_at = ?, dm_hidden = 1, last_seen_at = ? WHERE room_id = ? AND user_id = ?').run(now, now, room.id, user.id);
  return { data: { ok: true } };
}

/** POST /api/chat/dm/list -> my conversations, newest first. A conversation the other person started stays hidden until they write. */
export function listConversations(user) {
  const [sql, params] = visibleRoomSql({ user });
  const rooms = db
    .prepare(`SELECT chat_rooms.id, chat_rooms.created_by, chat_rooms.created_at, m.last_seen_at, m.cleared_at, m.dm_hidden
                FROM chat_rooms JOIN room_members m ON m.room_id = chat_rooms.id AND m.user_id = ?
               WHERE chat_rooms.dm_key IS NOT NULL AND ${sql}`)
    .all(user.id, ...params);
  const out = [];
  for (const r of rooms) {
    const peer = db.prepare(`${PEER_SQL} JOIN room_members m ON m.user_id = p.id WHERE m.room_id = ? AND m.user_id != ?`).get(r.id, user.id);
    if (!peer) continue; // the other person deleted their account
    const last = db.prepare('SELECT sender_id, content, msg_type, attachment_name, created_at FROM messages WHERE room_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1').get(r.id, r.cleared_at ?? '');
    // Empty chats stay hidden, unless you started this one and have not deleted it (or you deleted it and then opened it again)
    if (!last && (r.dm_hidden || (r.created_by !== user.id && !r.cleared_at))) continue;
    const unread = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE room_id = ? AND sender_id != ? AND created_at > ?').get(r.id, user.id, [r.last_seen_at ?? '', r.cleared_at ?? ''].sort().pop()).n;
    out.push({
      room_id: r.id,
      peer,
      last: last ? { preview: previewOf(last), from_me: last.sender_id === user.id, created_at: last.created_at } : null,
      activity_at: last?.created_at ?? r.created_at,
      unread,
      blocked_by_me: hasBlocked(user.id, peer.id),
    });
  }
  out.sort((a, b) => b.activity_at.localeCompare(a.activity_at));
  return { data: out };
}

/** POST /api/chat/dm/unread -> { total, rooms: { room_id: count } }. Small and cheap: used for the badge in the menu. */
export function unreadSummary(user) {
  const [sql, params] = visibleRoomSql({ user });
  const rows = db
    .prepare(`SELECT chat_rooms.id AS room_id, COUNT(msg.id) AS n
                FROM chat_rooms
                JOIN room_members m ON m.room_id = chat_rooms.id AND m.user_id = ?
                JOIN messages msg ON msg.room_id = chat_rooms.id AND msg.sender_id != ? AND msg.created_at > MAX(COALESCE(m.last_seen_at, ''), COALESCE(m.cleared_at, ''))
               WHERE chat_rooms.dm_key IS NOT NULL AND ${sql}
               GROUP BY chat_rooms.id`)
    .all(user.id, user.id, ...params);
  const rooms = Object.fromEntries(rows.map((r) => [r.room_id, r.n]));
  return { data: { total: rows.reduce((t, r) => t + r.n, 0), rooms } };
}

/** POST /api/chat/dm/seen { room_id }: "I have read this conversation". Private; the other person is not told. */
export function markSeen(user, body) {
  const room = myConversation(user, body.room_id);
  if (!room) throw new HttpError('Conversation not found', 404);
  const newest = db.prepare('SELECT MAX(created_at) AS t FROM messages WHERE room_id = ?').get(room.id)?.t;
  if (newest) {
    db.prepare('UPDATE room_members SET last_seen_at = ? WHERE room_id = ? AND user_id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)').run(newest, room.id, user.id, newest);
  }
  return { data: { ok: true } };
}

/** POST /api/chat/dm/block { user_id } and /dm/unblock { user_id } */
export function setBlocked(user, body, blocked) {
  const targetId = String(body.user_id ?? '');
  if (!targetId || targetId === user.id) throw new HttpError('Choose someone else');
  if (!db.prepare('SELECT 1 FROM profiles WHERE id = ?').get(targetId)) throw new HttpError('That person was not found', 404);
  if (blocked) db.prepare('INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)').run(user.id, targetId);
  else db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').run(user.id, targetId);
  return { data: { ok: true } };
}

/** POST /api/chat/dm/people { q } -> people to message. With no search text: the website admins. Email addresses are never included.
 *  Anyone who blocked you is left out. */
export function searchPeople(user, body) {
  const q = String(body.q ?? '').trim().slice(0, 60);
  const notBlockedMe = 'NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = p.id AND b.blocked_id = ?)';
  const rows =
    q.length < 2
      ? db.prepare(`${PEER_SQL} WHERE p.id != ? AND p.role IN ('admin', 'super_admin') AND ${notBlockedMe} ORDER BY p.full_name LIMIT 10`).all(user.id, user.id)
      : db
          .prepare(`${PEER_SQL} WHERE p.id != ? AND p.full_name LIKE ? ESCAPE '\\' AND ${notBlockedMe} ORDER BY p.full_name LIMIT 20`)
          .all(user.id, `%${q.replace(/[\\%_]/g, '\\$&')}%`, user.id);
  return { data: { suggested: q.length < 2, people: rows } };
}
