import { Resend } from 'resend';
import { HuntCompletionEmail } from '@/components/emails/HuntCompletionEmail';
import { NextResponse } from 'next/server';
import { ValidationError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/withErrorHandling';

export const POST = withErrorHandling(async (request: Request) => {
  const resend = new Resend(process.env.RESEND_API_KEY);

  let body: { huntName: string; creatorEmail?: string; completionTime: string };
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }
  const { huntName, creatorEmail, completionTime } = body;

  if (!creatorEmail) {
    throw new ValidationError('Missing creator email', { field: 'creatorEmail' });
  }

  const data = await resend.emails.send({
    from: 'Hunty <onboarding@resend.dev>', // Replace with your verified domain in production
    to: [creatorEmail],
    subject: 'Your hunt was just completed 🎉',
    react: <HuntCompletionEmail
      huntName={huntName}
      completionTime={completionTime}
    />,
  });

  return NextResponse.json(data);
});
