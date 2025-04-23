const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { user } = await req.json();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Your Name <you@yourdomain.com>',
      to: 'yournotificationemail@domain.com',
      subject: 'New User Sign-Up',
      html: `<p>A new user has signed up with email: ${user.email}</p>`,
    }),
  });

  return new Response(await res.text(), { status: res.status });
});
