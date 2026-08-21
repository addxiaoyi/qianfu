import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/api/request';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft } from 'lucide-react';
import { useT } from '@/store/uiStore';
import GeometricLantern from '@/components/ui/GeometricLantern';

const TicketCreate: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const ticketSchema = z.object({
    subject: z.string().min(5, t('ticket.form.subject.placeholder')).max(100),
    type: z.enum(['GENERAL', 'BILLING', 'TECHNICAL', 'REPORT']),
    content: z.string().min(20, t('ticket.form.content.placeholder')),
  });

  type TicketFormValues = z.infer<typeof ticketSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { type: 'GENERAL' }
  });

  const onSubmit = async (values: TicketFormValues) => {
    setLoading(true);
    try {
      const created = await api.post<any>('/tickets', {
        title: values.subject,
        description: `[${values.type}]\n${values.content}`,
        priority: values.type === 'BILLING' || values.type === 'TECHNICAL' ? 'HIGH' : 'MEDIUM',
      });
      toast({
        title: t('ticket.status.submitted'),
        description: t('ticket.status.submitted_desc')
      });
      navigate(`/dashboard/tickets/${created?.id ?? ''}`.replace(/\/$/, ''));
    } catch {
      toast({ title: t('common.error'), description: '工单提交失败，请稍后再试', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 selection:bg-accent selection:text-white">
      <button 
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors mb-6 sm:mb-8 font-semibold uppercase text-[10px] tracking-[0.3em]"
      >
        <ChevronLeft className="w-5 h-5" /> {t('ticket.back')}
      </button>

      <div className="mb-8 sm:mb-10 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600">Support</div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight uppercase leading-[0.95] text-zinc-900">{t('ticket.create.title')}.</h1>
        <p className="text-zinc-500 font-medium text-sm sm:text-base leading-7 max-w-2xl">{t('ticket.create.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 sm:space-y-10">
        <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-white p-5 sm:p-8 md:p-12 space-y-8 sm:space-y-10 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
          <div className="space-y-4">
            <label htmlFor="ticket-subject" className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 flex items-center gap-3">
               <GeometricLantern variant="terminal" className="w-4 h-4 text-accent" /> {t('ticket.form.subject')}
            </label>
            <input 
              id="ticket-subject"
              {...register('subject')}
              className="w-full rounded-[1.5rem] border border-zinc-100 bg-zinc-50 px-4 sm:px-5 py-4 outline-none transition-all focus:border-zinc-300 focus:bg-white"
              placeholder={t('ticket.form.subject.placeholder')}
            />
            {errors.subject && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-4">// ERROR: {errors.subject.message}</p>}
          </div>

          <div className="space-y-4">
            <label htmlFor="ticket-type" className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 flex items-center gap-3">
               <GeometricLantern variant="settings" className="w-4 h-4 text-accent" /> {t('ticket.form.type')}
            </label>
            <div className="relative group">
               <select 
                 id="ticket-type"
                 {...register('type')}
                 className="w-full rounded-[1.5rem] border border-zinc-100 bg-zinc-50 px-4 sm:px-5 py-4 outline-none font-semibold tracking-[0.08em] transition-all appearance-none cursor-pointer uppercase text-sm focus:border-zinc-300 focus:bg-white"
               >
                 <option value="GENERAL">{t('ticket.form.type.general')}</option>
                 <option value="TECHNICAL">{t('ticket.form.type.technical')}</option>
                 <option value="REPORT">{t('ticket.form.type.report')}</option>
               </select>
               <div className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-300 group-hover:text-accent transition-colors">
                  <GeometricLantern variant="spark" className="w-5 h-5 rotate-90" />
               </div>
            </div>
          </div>

          <div className="space-y-4">
            <label htmlFor="ticket-content" className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 flex items-center gap-3">
               <GeometricLantern variant="data" className="w-4 h-4 text-accent" /> {t('ticket.form.content')}
            </label>
            <textarea 
              id="ticket-content"
              {...register('content')}
              className="w-full min-h-44 rounded-[1.5rem] border border-zinc-100 bg-zinc-50 px-4 sm:px-5 py-4 outline-none transition-all focus:border-zinc-300 focus:bg-white resize-y"
              placeholder={t('ticket.form.content.placeholder')}
            />
            {errors.content && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-4">// ERROR: {errors.content.message}</p>}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-10 p-5 sm:p-8 md:p-10 bg-zinc-50 border border-zinc-100 border-dashed rounded-[2rem] sm:rounded-[3rem] group hover:border-accent transition-all duration-700">
           <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white border border-zinc-50 rounded-[1.5rem] flex items-center justify-center shadow-xs shrink-0 group-hover:rotate-12 transition-all">
              <GeometricLantern variant="security" className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-accent" />
           </div>
           <p className="text-[12px] text-zinc-500 font-medium leading-6">{t('ticket.footer.hint')}</p>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-5 sm:py-6 md:py-8 rounded-[1.75rem] sm:rounded-[2rem] bg-black text-white font-semibold text-[11px] sm:text-[12px] uppercase tracking-[0.35em] transition-all flex items-center justify-center gap-3 sm:gap-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] active:scale-[0.98]"
        >
          {loading ? <Loader2 className="w-7 h-7 animate-spin text-white/50" /> : <GeometricLantern variant="activity" className="w-7 h-7 group-hover:rotate-180 transition-transform duration-1000" />}
          {t('common.submit')}
        </button>
      </form>
    </div>
  );
};

export default TicketCreate;
