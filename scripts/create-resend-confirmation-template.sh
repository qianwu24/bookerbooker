#!/bin/bash
# Creates a confirmation email template on Resend via the API.
# Usage: RESEND_API_KEY=re_xxx ./create-resend-confirmation-template.sh

set -e

if [ -z "$RESEND_API_KEY" ]; then
  echo "Error: RESEND_API_KEY environment variable is required"
  exit 1
fi

HTML_BODY=$(cat <<'EOF'
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
  <h2 style="margin:0 0 12px 0;">You're confirmed: {{event_title}}</h2>
  <p style="margin:0 0 12px 0;">Hi {{invitee_name}},</p>
  <p style="margin:0 0 14px 0;">You are confirmed for <strong>{{event_title}}</strong>.</p>
  <div style="margin:0 0 14px 0;">
    <a href="{{confirm_url}}" style="display:inline-block;padding:12px 16px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;text-align:center;">View event</a>
  </div>
  <p style="margin:0 0 12px 0;">Event details:</p>
  <ul style="padding-left:18px;margin:0 0 16px 0;line-height:1.4;">
    <li><strong>Date:</strong> {{event_date}}</li>
    <li><strong>Time:</strong> {{event_time}} ({{event_time_zone}})</li>
    <li><strong>Duration:</strong> {{event_duration}}</li>
    <li><strong>Location:</strong> {{event_location}}</li>
    <li><strong>Organizer:</strong> {{host_name}}</li>
  </ul>
  <p style="margin:0 0 16px 0;">Notes: {{event_notes}}</p>
  <p style="margin:0;font-size:12px;color:#475569;">If the button does not work, open: {{confirm_url}}</p>
</div>
EOF
)

# Escape the HTML for JSON
HTML_ESCAPED=$(echo "$HTML_BODY" | jq -Rsa .)

curl -s -X POST "https://api.resend.com/emails/templates" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Booker - Confirmation\",
    \"subject\": \"You're confirmed: {{event_title}}\",
    \"html\": $HTML_ESCAPED
  }" | jq .

echo ""
echo "Copy the 'id' from above and set it as RESEND_CONFIRM_TEMPLATE_ID in your Edge function environment."
