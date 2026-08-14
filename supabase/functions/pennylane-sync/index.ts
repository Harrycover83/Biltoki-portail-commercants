// Supabase Edge Function placeholder.
// Keep all Pennylane API calls server-side only.

Deno.serve(async (_request) => {
  return new Response(
    JSON.stringify({
      error:
        'Pennylane sync function scaffolded. Implement only after validating official API endpoints and business mapping.',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 501,
    },
  )
})
