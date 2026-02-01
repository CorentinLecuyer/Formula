import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import nodemailer from "npm:nodemailer@6.9.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle Browser CORS checks (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Grab data sent from Vue
    const { to, subject, text, pdfBase64, filename } = await req.json()

    // 2. Setup Hostinger SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
      },
    })

    // 3. Send Email
    const info = await transporter.sendMail({
      from: `"Form System" <${Deno.env.get('SMTP_USER')}>`, // Sender address
      to: to, // Recipient list
      subject: subject,
      text: text,
      attachments: [
        {
          filename: filename || 'submission.pdf',
          content: pdfBase64,
          encoding: 'base64',
        },
      ],
    })

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})