import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import nodemailer from "npm:nodemailer@6.9.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeRecipients = (to: unknown): string[] => {
  const rawRecipients = Array.isArray(to)
    ? to
    : String(to || '')
        .split(/[;,]/)
        .map((entry) => entry.trim())

  return [...new Set(
    rawRecipients
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => EMAIL_REGEX.test(entry)),
  )]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')

    if (!smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: 'SMTP_USER or SMTP_PASS is not configured in Supabase secrets.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

    const { to, subject, text, pdfBase64, filename } = await req.json()
    const recipients = normalizeRecipients(to)

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid email recipients were provided.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: 'Missing PDF attachment content.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    const info = await transporter.sendMail({
      from: `"Form System" <${smtpUser}>`,
      to: recipients.join(','),
      subject: subject || 'Bon de commande',
      text: text || 'Veuillez trouver le bon de commande en pièce jointe.',
      attachments: [
        {
          filename: filename || 'bon_de_commande.pdf',
          content: pdfBase64,
          encoding: 'base64',
        },
      ],
    })

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('send-email failed:', error)

    return new Response(JSON.stringify({ error: error.message || 'Unknown email error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
