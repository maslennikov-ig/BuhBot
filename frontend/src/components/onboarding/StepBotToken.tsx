import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { trpc } from '@/lib/trpc';

const formSchema = z.object({
  token: z.string().min(10, 'Token is too short'),
});

interface StepBotTokenProps {
  onNext: () => void;
}

export function StepBotToken({ onNext }: StepBotTokenProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: '',
    },
  });

  const setupMutation = trpc.settings.setupTelegramBot.useMutation({
    onSuccess: () => {
      onNext();
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setupMutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="token"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telegram Bot Token</FormLabel>
              <FormControl>
                <Input placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" {...field} />
              </FormControl>
              <FormDescription>
                Create a new bot via @BotFather and paste the token here.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={setupMutation.isPending}>
          {setupMutation.isPending ? 'Verifying...' : 'Connect Bot'}
        </Button>
        {setupMutation.error && (
          <p className="text-red-500 text-sm text-center">{setupMutation.error.message}</p>
        )}
      </form>
    </Form>
  );
}
