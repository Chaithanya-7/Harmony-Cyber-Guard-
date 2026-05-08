import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const functionUrl = url.origin + url.pathname

  // TwiML Handler (Twilio calls this to get instructions)
  if (req.method === 'GET' || url.searchParams.get('action') === 'twiml') {
    let bridgeTo = url.searchParams.get('bridgeTo') || ''
    if (bridgeTo && !bridgeTo.startsWith('+')) bridgeTo = '+' + bridgeTo.trim()

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Cyber Guard Secure Line Active. Connecting to investigator.</Say>
  <Dial><Number>${bridgeTo}</Number></Dial>
</Response>`
    return new Response(twiml, { 
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      status: 200
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { action, to, sid, token, userNumber, from } = body

    const accountSid = (sid || Deno.env.get('TWILIO_ACCOUNT_SID') || '').trim()
    const authToken = (token || Deno.env.get('TWILIO_AUTH_TOKEN') || '').trim()
    const twilioNumber = (from || Deno.env.get('TWILIO_PHONE_NUMBER') || '').trim()
    const myPhone = (userNumber || '+917019186014').trim()
    
    // Ensure target number is formatted
    let targetPhone = to || ''
    if (targetPhone && !targetPhone.startsWith('+')) targetPhone = '+' + targetPhone.trim()

    if (action === 'make-call') {
      // Point Twilio to bridge to the investigator AFTER the target answers
      const callbackUrl = `https://hjvdprokoxhtjeteyijt.supabase.co/functions/v1/twilio-voice?action=twiml&bridgeTo=${encodeURIComponent(myPhone)}`
      console.log(`[Twilio Debug] Dialing Target: ${targetPhone}, Bridging to: ${myPhone}`)

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: new URLSearchParams({ 
          To: targetPhone, 
          From: twilioNumber, 
          Url: callbackUrl 
        }),
      })

      const result = await response.json()
      console.log(`[Twilio Debug] API Result:`, result)

      return new Response(JSON.stringify({ 
        success: response.ok, 
        callSid: result.sid, 
        error: response.ok ? null : `${result.message} (Code: ${result.code})`,
        details: result.more_info
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid Action' }), { headers: corsHeaders, status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: corsHeaders, status: 200 })
  }
})
