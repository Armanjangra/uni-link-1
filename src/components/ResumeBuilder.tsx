import { useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { printWithPageStyle } from '@/lib/printPage';

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const label = 'block text-xs font-semibold text-slate-500 dark:text-slate-400';

export default function ResumeBuilder() {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({
    name: profile?.full_name ?? '', email: user?.email ?? '', phone: '', location: '',
    headline: 'Student | Aspiring professional', summary: profile?.bio ?? '',
    education: '', skills: '', projects: '', experience: '', links: profile?.portfolio_url ?? '',
  });
  const update = (key: keyof typeof form, value: string) => setForm(old => ({ ...old, [key]: value }));
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,380px)_1fr]">
    <section className="resume-print-hide rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"><FileText className="h-5 w-5"/></div><div><h2 className="font-heading text-lg font-bold">Resume builder</h2><p className="text-xs text-slate-500">Fill in your details and preview the result.</p></div></div>
      <div className="space-y-3">
        {([['name','Full name'],['email','Email'],['phone','Phone (optional)'],['location','City / location'],['headline','Professional headline'],['links','Portfolio or LinkedIn URL']] as const).map(([key,title])=><label key={key} className={label}>{title}<input className={`${field} mt-1`} value={form[key]} onChange={e=>update(key,e.target.value)} maxLength={180}/></label>)}
        {([['summary','Profile summary'],['education','Education'],['skills','Skills (comma separated)'],['projects','Projects and achievements'],['experience','Experience / volunteering']] as const).map(([key,title])=><label key={key} className={label}>{title}<textarea className={`${field} mt-1`} value={form[key]} onChange={e=>update(key,e.target.value)} rows={key==='summary'?4:3} maxLength={key==='summary'?1200:2000} placeholder={key==='education'?'Degree, institution, expected graduation, relevant coursework…':key==='projects'?'Project — what you built, tools used, measurable impact…':key==='experience'?'Role, organization, dates, and accomplishments…':''}/></label>)}
      </div>
      <button onClick={()=>printWithPageStyle('size: A4; margin: 0;')} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"><Printer className="h-4 w-4"/> Print / Save as PDF</button>
      <p className="mt-2 text-xs leading-5 text-slate-400">Use your browser’s print dialog and choose “Save as PDF”. Your draft stays in this page and is not submitted to a server.</p>
    </section>
    <section className="resume-print-area min-h-[720px] rounded-2xl border border-slate-200 bg-white p-7 text-slate-900 shadow-sm sm:p-10 dark:border-slate-800 dark:bg-white">
      <div className="border-b-2 border-slate-900 pb-5">
        <h1 className="break-words text-3xl font-bold tracking-tight">{form.name || 'Your Name'}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-600">{form.headline || 'Professional headline'}</p>
        <p className="mt-3 break-words text-xs text-slate-500">{[form.email,form.phone,form.location,form.links].filter(Boolean).join('  •  ')}</p>
      </div>
      {([['PROFILE',form.summary],['EDUCATION',form.education],['SKILLS',form.skills],['PROJECTS & ACHIEVEMENTS',form.projects],['EXPERIENCE & LEADERSHIP',form.experience]] as const).filter(([,value])=>value.trim()).map(([heading,value])=><section className="mt-6 break-inside-avoid" key={heading}><h2 className="border-b border-slate-200 pb-1 text-xs font-bold tracking-[.18em] text-slate-700">{heading}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{heading==='SKILLS'?value.split(/[,;]+/).map(s=>s.trim()).filter(Boolean).join('  •  '):value}</p></section>)}
      {!form.summary&&!form.education&&!form.skills&&!form.projects&&!form.experience&&<p className="mt-8 text-sm text-slate-400">Your resume preview will update as you fill in the fields.</p>}
      <p className="resume-print-hide mt-12 flex items-center gap-2 text-xs text-slate-400"><Download className="h-3.5 w-3.5"/> Tip: use concise action verbs and include measurable results where possible.</p>
    </section>
  </div>;
}
