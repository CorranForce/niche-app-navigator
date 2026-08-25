import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute("/lovable/email/events")({
  server: {
    handlers: {
      POST: ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']
        if (!apiKey) {
          console.error('Missing required environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const handler = createEmailWebhookHandler({
          apiKey,
          on: {
            'email.bounced': async (event) => {
              const { flagUndeliverableCustomer } = await import('@/lib/email-outcomes.server')
              await flagUndeliverableCustomer(event.data.recipient, 'bounced', event.event_id)
            },
            'email.complaint': async (event) => {
              const { flagUndeliverableCustomer } = await import('@/lib/email-outcomes.server')
              await flagUndeliverableCustomer(event.data.recipient, 'complaint', event.event_id)
            },
            'email.unsubscribed': async (event) => {
              const { flagUndeliverableCustomer } = await import('@/lib/email-outcomes.server')
              await flagUndeliverableCustomer(event.data.recipient, 'unsubscribed', event.event_id)
            },
          },
        })
        return handler(request)
      },
    },
  },
})
