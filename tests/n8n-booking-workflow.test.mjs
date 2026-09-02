import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowPath = new URL(
  '../automation/n8n/cinematic-flight-prospect-booking.json',
  import.meta.url,
)

const workflow = JSON.parse(await readFile(workflowPath, 'utf8'))
const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]))

test('booking workflow stays inactive and uses the Manila timezone', () => {
  assert.equal(workflow.active, false)
  assert.equal(workflow.settings.timezone, 'Asia/Manila')
})

test('webhook requires header authentication and explicit responses', () => {
  const webhook = nodeByName.get('Booking webhook')

  assert.ok(webhook)
  assert.equal(webhook.parameters.httpMethod, 'POST')
  assert.equal(webhook.parameters.authentication, 'headerAuth')
  assert.equal(webhook.parameters.responseMode, 'responseNode')
})

test('validation requires name and email and limits conversation choices', () => {
  const validationCode = nodeByName.get('Validate and normalize')?.parameters.jsCode

  assert.match(validationCode, /Name is required/)
  assert.match(validationCode, /A valid email is required/)
  assert.match(validationCode, /Photograph reading/)
  assert.match(validationCode, /New property website/)
  assert.match(validationCode, /Add the cinematic experience/)
  assert.match(validationCode, /request ID is required/i)
})

test('workflow defines invalid, unavailable, and success responses', () => {
  assert.equal(
    nodeByName.get('Reject invalid request')?.parameters.options.responseCode,
    422,
  )
  assert.equal(
    nodeByName.get('Return unavailable')?.parameters.options.responseCode,
    409,
  )
  assert.equal(
    nodeByName.get('Return booking confirmation')?.parameters.options.responseCode,
    201,
  )
})

test('workflow covers calendar, email, and audit destinations', () => {
  const requiredNodes = [
    'Check calendar conflicts',
    'Create calendar event',
    'Email prospect through Brevo',
    'Notify owner through Brevo',
    'Append booking audit row',
  ]

  for (const name of requiredNodes) assert.ok(nodeByName.has(name), name)
})

test('workflow export contains placeholders but no embedded credentials', () => {
  const serialized = JSON.stringify(workflow)

  assert.match(serialized, /REPLACE_WITH_BOOKING_CALENDAR_ID/)
  assert.match(serialized, /REPLACE_WITH_VERIFIED_BREVO_SENDER/)
  assert.match(serialized, /REPLACE_WITH_OWNER_EMAIL/)
  assert.match(serialized, /REPLACE_WITH_GOOGLE_SHEET_ID/)
  assert.equal(workflow.nodes.some((node) => node.credentials), false)
})
