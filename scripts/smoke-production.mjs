const baseUrl = (process.env.SMOKE_BASE_URL || "https://guestopshq.com").replace(
  /\/$/,
  ""
);

const checks = [
  {
    name: "public login page",
    path: "/login",
    expectedStatus: 200,
    expectedHeaders: {
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "content-security-policy": "required",
    },
  },
  {
    name: "protected dashboard redirects anonymous visitors",
    path: "/dashboard",
    expectedStatus: 307,
    expectedLocation: "/login",
  },
  {
    name: "conversation API rejects anonymous requests",
    path: "/api/conversations",
    expectedStatus: 401,
  },
  {
    name: "conversation message history rejects anonymous requests",
    path: "/api/conversations/not-a-conversation/messages",
    expectedStatus: 401,
  },
  {
    name: "conversation thread rejects anonymous requests",
    path: "/api/conversations/not-a-conversation/thread",
    expectedStatus: 401,
  },
  {
    name: "internal notes reject anonymous requests",
    path: "/api/conversations/not-a-conversation/internal-notes",
    expectedStatus: 401,
  },
  {
    name: "property list rejects anonymous requests",
    path: "/api/properties",
    expectedStatus: 401,
  },
  {
    name: "property guide rejects anonymous requests",
    path: "/api/properties/not-a-property",
    expectedStatus: 401,
  },
  {
    name: "quick replies reject anonymous requests",
    path: "/api/quick-replies",
    expectedStatus: 401,
  },
  {
    name: "vendor directory rejects anonymous requests",
    path: "/api/vendors",
    expectedStatus: 401,
  },
  {
    name: "profile lookup rejects anonymous requests",
    path: "/api/profiles/lookup",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    expectedStatus: 401,
  },
  {
    name: "booking stay updates reject anonymous requests",
    path: "/api/bookings/not-a-booking",
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "{}",
    expectedStatus: 401,
  },
  {
    name: "conversation stay updates reject anonymous requests",
    path: "/api/conversations/not-a-conversation/stay",
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "{}",
    expectedStatus: 401,
  },
  {
    name: "inbound webhook rejects an unsigned request",
    path: "/api/twilio/inbound",
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "From=%2B16095550123&To=%2B16095550456&Body=Unauthorized",
    expectedStatus: 401,
  },
  {
    name: "delivery-status webhook rejects an unsigned request",
    path: "/api/twilio/status",
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "MessageSid=SMnotarealmessage&MessageStatus=delivered",
    expectedStatus: 403,
  },
  {
    name: "retired legacy send API remains unavailable",
    path: "/api/messages/send",
    method: "POST",
    expectedStatus: 410,
  },
];

let failures = 0;

for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method || "GET",
    headers: check.headers,
    body: check.body,
    redirect: "manual",
  });

  const problems = [];
  if (response.status !== check.expectedStatus) {
    problems.push(`expected ${check.expectedStatus}, got ${response.status}`);
  }

  if (check.expectedLocation) {
    const location = response.headers.get("location") || "";
    if (!location.includes(check.expectedLocation)) {
      problems.push(`expected redirect to ${check.expectedLocation}, got ${location || "none"}`);
    }
  }

  for (const [header, expectedValue] of Object.entries(
    check.expectedHeaders || {}
  )) {
    const actualValue = response.headers.get(header);
    if (
      expectedValue !== "required" &&
      actualValue?.toLowerCase() !== expectedValue.toLowerCase()
    ) {
      problems.push(`expected ${header}: ${expectedValue}, got ${actualValue || "missing"}`);
    }
    if (expectedValue === "required" && !actualValue) {
      problems.push(`expected ${header}, got missing`);
    }
  }

  if (problems.length) {
    failures += 1;
    console.error(`FAIL ${check.name}: ${problems.join("; ")}`);
  } else {
    console.log(`PASS ${check.name}`);
  }
}

if (failures) {
  console.error(`\n${failures} smoke check${failures === 1 ? "" : "s"} failed for ${baseUrl}.`);
  process.exit(1);
}

console.log(`\nAll smoke checks passed for ${baseUrl}.`);
