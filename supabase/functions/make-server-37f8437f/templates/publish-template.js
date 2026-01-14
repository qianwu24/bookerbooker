#!/usr/bin/env node
import fs from "fs";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const templateName = process.env.RESEND_TEMPLATE_NAME || "booker-invite-v1";

if (!apiKey) {
  console.error("RESEND_API_KEY is required in the environment");
  process.exit(1);
}

const htmlPath = new URL("./booker-invite-v1.html", import.meta.url);
const html = fs.readFileSync(htmlPath, "utf8");

const text = (
  "Hi {{{invitee_name}}},\n\n" +
  "{{{host_name}}} invited you to {{{event_title}}} on {{{event_date}}} at {{{event_time}}}.\n" +
  "Location: {{{event_location}}}\n" +
  "Notes: {{{event_notes}}}\n\n" +
  "Confirm: {{{confirm_url}}}\n" +
  "Decline: {{{decline_url}}}\n\n" +
  "Sent by Booker · {{{org_name}}}"
);

const variables = [
  { key: "invitee_name", type: "string", fallbackValue: "there" },
  { key: "host_name", type: "string", fallbackValue: "A host" },
  { key: "event_title", type: "string", fallbackValue: "your event" },
  { key: "event_date", type: "string", fallbackValue: "a date" },
  { key: "event_time", type: "string", fallbackValue: "a time" },
  { key: "event_location", type: "string", fallbackValue: "TBD" },
  { key: "event_notes", type: "string", fallbackValue: "—" },
  { key: "confirm_url", type: "string", fallbackValue: "https://example.com/confirm" },
  { key: "decline_url", type: "string", fallbackValue: "https://example.com/decline" },
  { key: "org_name", type: "string", fallbackValue: "Booker" },
];

const resend = new Resend(apiKey);

async function createAndPublish() {
  console.log(`Creating template '${templateName}'...`);
  const { data, error } = await resend.templates.create({
    name: templateName,
    subject: "You're invited: {{{event_title}}} — please RSVP",
    html,
    text,
    variables,
  });

  if (error || !data?.id) {
    throw new Error(error?.message || "Template creation failed");
  }

  console.log(`Created template id: ${data.id}`);
  console.log("Publishing template...");
  const publish = await resend.templates.publish(data.id);
  if (publish.error) {
    throw new Error(publish.error.message || "Template publish failed");
  }
  console.log("Template published and ready to use.");
}

createAndPublish().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
