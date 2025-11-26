import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { trpc } from '@/lib/trpc';

const formSchema = z.object({
  slaThreshold: z.number().min(1).max(480),
});

interface StepSlaProps {
  onComplete: () => void;
}

export function StepSla({ onComplete }: StepSlaProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slaThreshold: 60,
    },
  });

  const updateSlaMutation = trpc.settings.updateSlaThresholds.useMutation();
  const completeMutation = trpc.settings.completeOnboarding.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await updateSlaMutation.mutateAsync(values);
      await completeMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }

  const isSubmitting = updateSlaMutation.isPending || completeMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="slaThreshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SLA Response Time (Minutes)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                The maximum time allowed to respond to a client request before it's marked as breached.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="bg-blue-50 p-4 rounded-md text-blue-800 text-sm">
          <p className="font-semibold mb-1">You're almost done!</p>
          <p>Clicking "Finish Setup" will activate your dashboard and you can start connecting clients.</p>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Finalizing...' : 'Finish Setup'}
        </Button>
        {completeMutation.error && (
          <p className="text-red-500 text-sm text-center">{completeMutation.error.message}</p>
        )}
      </form>
    </Form>
  );
}
