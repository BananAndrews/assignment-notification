// ============================================================
//  Blue Belle Weddings – Creative Assignment Notification
//
//  Sends a personalised assignment email to every creative in
//  columns O–R of the "Bookings" sheet approximately one hour
//  after the checkbox in Column A is checked.
//
//  HOW TO DEPLOY
//  1. Open your Google Spreadsheet.
//  2. Extensions → Apps Script → paste this file.
//  3. Save, then run createTrigger() ONCE to install the trigger.
//  4. Authorise the script when prompted.
// ============================================================

// ── Configuration (edit here only) ───────────────────────────
var BOOKINGS_SHEET    = "Bookings";
var CONTRACTORS_SHEET = "Contractors";

// Bookings sheet – column indices (0-based, A=0)
var COL_CHECKBOX     = 0;            // A – green checkbox trigger
var COL_PROJECT_NAME = 4;            // E – project / couple name
var COL_CREATIVES    = [14,15,16,17];// O, P, Q, R – assigned creative names

// Contractors sheet – column indices (0-based)
var COL_CONTRACTOR_NAME  = 2;        // C – full name
var COL_CONTRACTOR_EMAIL = 3;        // D – email address

// Tracking columns written by this script (must be empty in your sheet)
var COL_QUEUED_AT = 24;              // Y – ISO timestamp when checkbox was first seen
var COL_NOTIFIED  = 25;              // Z – set to "YES" after emails are sent

// Only process rows at or after this 1-based row number.
// Rows before START_ROW are never touched.
var START_ROW = 54;

// Delay before sending (milliseconds). Default: 1 hour.
var DELAY_MS = 60 * 60 * 1000;

// Creatives Portal link embedded in every email
var HANDBOOK_URL = "https://sites.google.com/bluebelleweddings.com/creativesportal/home?authuser=7";

// ── Main function (runs every 15 minutes via trigger) ─────────
function checkBookingsAndNotify() {
  var ss                = SpreadsheetApp.getActiveSpreadsheet();
  var bookingsSheet     = ss.getSheetByName(BOOKINGS_SHEET);
  var contractorsSheet  = ss.getSheetByName(CONTRACTORS_SHEET);

  if (!bookingsSheet || !contractorsSheet) {
    Logger.log("ERROR: Sheet '" + BOOKINGS_SHEET + "' or '" + CONTRACTORS_SHEET + "' not found.");
    return;
  }

  // Build contractor name → email lookup map
  var contractorData = contractorsSheet.getDataRange().getValues();
  var emailMap = {};
  for (var c = 0; c < contractorData.length; c++) {
    var cName  = String(contractorData[c][COL_CONTRACTOR_NAME]).trim();
    var cEmail = String(contractorData[c][COL_CONTRACTOR_EMAIL]).trim();
    if (cName && cEmail && cEmail.indexOf("@") !== -1) {
      emailMap[cName.toLowerCase()] = cEmail;
    }
  }

  var allRows    = bookingsSheet.getDataRange().getValues();
  var now        = new Date();
  var emailsSent = 0;

  // Convert START_ROW (1-based) to 0-based array index
  var startIndex = START_ROW - 1;

  for (var r = startIndex; r < allRows.length; r++) {
    var row      = allRows[r];
    var checked  = row[COL_CHECKBOX];
    var queuedAt = row[COL_QUEUED_AT];
    var notified = String(row[COL_NOTIFIED]).trim().toUpperCase();

    // Skip rows already processed
    if (notified === "YES") continue;

    // Checkbox must be TRUE (checked)
    if (checked !== true) continue;

    if (!queuedAt) {
      // First time we see this checkbox checked — record the timestamp
      bookingsSheet.getRange(r + 1, COL_QUEUED_AT + 1).setValue(now.toISOString());
      Logger.log("Row " + (r + 1) + ": Queued at " + now.toISOString());
      continue;
    }

    // Check if 1 hour has elapsed since queuing
    var elapsedMs = now.getTime() - new Date(queuedAt).getTime();
    if (elapsedMs < DELAY_MS) {
      Logger.log("Row " + (r + 1) + ": Waiting (" + Math.round(elapsedMs / 60000) + " min elapsed).");
      continue;
    }

    // Gather row data
    var projectName = String(row[COL_PROJECT_NAME]).trim();
    var sentCount   = 0;

    for (var i = 0; i < COL_CREATIVES.length; i++) {
      var creativeName = String(row[COL_CREATIVES[i]]).trim();
      if (!creativeName) continue;

      var recipientEmail = emailMap[creativeName.toLowerCase()];
      if (!recipientEmail) {
        Logger.log("  WARNING: No email for '" + creativeName + "' – skipped.");
        continue;
      }

      var firstName = creativeName.split(" ")[0];
      MailApp.sendEmail({
        to:       recipientEmail,
        subject:  buildSubject(projectName),
        htmlBody: buildEmailBody(firstName, projectName)
      });
      sentCount++;
      emailsSent++;
      Logger.log("  Sent to " + creativeName + " <" + recipientEmail + ">");
    }

    // Mark row as done (write timestamp so you know when it was sent)
    if (sentCount > 0) {
      bookingsSheet.getRange(r + 1, COL_NOTIFIED + 1).setValue("YES");
    }
  }

  Logger.log("Done. Total emails sent this run: " + emailsSent);
}

// ── Subject builder ───────────────────────────────────────────
function buildSubject(projectName) {
  return "Congratulations! You\u2019re assigned to " + projectName + "\u2019s Wedding \uD83C\uDF89";
}

// ── Email body builder ────────────────────────────────────────
function buildEmailBody(firstName, projectName) {
  var s = "<div style='font-family:Arial,sans-serif;font-size:15px;line-height:1.75;color:#222;max-width:700px'>";

  s += "<p>Hi " + firstName + ",</p>";
  s += "<p>Congratulations! You\u2019ve officially been assigned to <strong>" + projectName + "</strong>\u2019s wedding with Blue Belle Weddings.</p>";
  s += "<p>We\u2019ve added you to the project in HoneyBook and introduced you to the couple there, so you should now have access to all the project details.</p>";
  s += "<p>Below is a quick overview of your next steps to ensure an amazing experience for both you and the couple:</p>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<h3 style='color:#4a4a4a'>1. Confirm Receipt</h3>";
  s += "<p>Please reply to this email to confirm you\u2019ve received the assignment and that the dates look good on your end.</p>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<h3 style='color:#4a4a4a'>2. Initial Client Introduction <em>(Within 48 hours)</em></h3>";
  s += "<p>Please send a warm intro message to the couple via HoneyBook within the next 48 hours.</p>";
  s += "<p>Feel free to adapt this template:</p>";
  s += "<blockquote style='border-left:4px solid #ccc;margin:10px 0;padding:10px 16px;color:#555;background:#f9f9f9'>"
    + "<em>Hi [Bride + Groom Names], huge congratulations to you both! I\u2019m so excited to be your [Photographer/Videographer] "
    + "and capture your big day. I\u2019d love to connect on a quick call or Zoom whenever convenient to go over your vision "
    + "and ensure everything is perfectly aligned. Looking forward to meeting you both soon!</em>"
    + "</blockquote>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<h3 style='color:#4a4a4a'>3. Review Booking Details</h3>";
  s += "<p>Before your first call, please review the <strong>Files</strong> section in HoneyBook. Check the live invoice for:</p>";
  s += "<ul><li>Coverage hours and locations.</li>"
    + "<li>Specific services and add-ons (Second shooters, Drone, etc.).</li></ul>";
  s += "<p><strong>Creatives Portal:</strong> Don\u2019t forget to refresh your memory on our brand standards AND REQUIREMENTS at the "
    + "<a href='" + HANDBOOK_URL + "'>Creatives Portal &amp; Handbook</a>.</p>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<h3 style='color:#4a4a4a'>4. Schedule &amp; Updates</h3>";
  s += "<p>If the couple is open to it, please coordinate a call to build a connection and review the timeline.</p>";
  s += "<p><strong>Note:</strong> If anything comes up during your conversations (timeline changes, extra hours, or gear add-ons), "
    + "please email us directly so we can update their invoice and coverage accordingly.</p>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<h3 style='color:#4a4a4a'>5. Questionnaire &amp; Music <em>(Video Only)</em></h3>";
  s += "<p><strong>Questionnaires:</strong> Encourage the couple to complete their Wedding Info and Group Photo list in HoneyBook if they haven\u2019t already.</p>";
  s += "<p><strong>Music Selection:</strong> Remind them to choose between \u201cEditor\u2019s Choice\u201d or selecting tracks from "
    + "<a href='https://www.musicbed.com'>Musicbed.com</a> (please specify that we use ONLY licensed music from this platform).</p>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<h3 style='color:#4a4a4a'>6. Pre-Wedding Check-Ins</h3>";
  s += "<p>We recommend two touchpoints to keep things moving smoothly:</p>";
  s += "<ul><li><strong>1 month out:</strong> General check-in.</li>"
    + "<li><strong>Wedding week:</strong> Final confirmation of start times, addresses, and any last-minute timeline shifts.</li></ul>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<h3 style='color:#4a4a4a'>7. Wedding Day Touchpoint</h3>";
  s += "<p>On the morning of the wedding, send a quick, upbeat text:</p>";
  s += "<blockquote style='border-left:4px solid #ccc;margin:10px 0;padding:10px 16px;color:#555;background:#f9f9f9'>"
    + "<em>\u201cGood morning and happy wedding day! I\u2019m so excited for today. "
    + "I\u2019ll see you at [Time] at [Location]. Let\u2019s make it amazing!\u201d</em>"
    + "</blockquote>";

  s += "<hr style='border:none;border-top:1px solid #ddd;margin:20px 0'>";
  s += "<p>We truly appreciate having you on the team and know you\u2019re going to do an incredible job. "
    + "If you have any questions along the way, just reach out!</p>";
  s += "<p>Cheers,<br><strong>Jack &amp; Andrew</strong><br>Blue Belle Weddings</p>";
  s += "</div>";
  return s;
}

// ── Diagnostic helper (no emails sent) ───────────────────────
function debugNotifications() {
  var ss               = SpreadsheetApp.getActiveSpreadsheet();
  var bookingsSheet    = ss.getSheetByName(BOOKINGS_SHEET);
  var contractorsSheet = ss.getSheetByName(CONTRACTORS_SHEET);

  Logger.log("=== DEBUG START ===");
  if (!bookingsSheet)    { Logger.log("FAIL: '" + BOOKINGS_SHEET + "' not found!");    return; }
  if (!contractorsSheet) { Logger.log("FAIL: '" + CONTRACTORS_SHEET + "' not found!"); return; }

  var contractorData = contractorsSheet.getDataRange().getValues();
  var emailMap = {};
  Logger.log("Contractors rows (incl. header): " + contractorData.length);
  for (var c = 0; c < contractorData.length; c++) {
    var cn = String(contractorData[c][COL_CONTRACTOR_NAME]).trim();
    var ce = String(contractorData[c][COL_CONTRACTOR_EMAIL]).trim();
    Logger.log("  Row " + (c+1) + ": name='" + cn + "'  email='" + ce + "'");
    if (cn && ce && ce.indexOf("@") !== -1) emailMap[cn.toLowerCase()] = ce;
  }

  var now        = new Date();
  var allRows    = bookingsSheet.getDataRange().getValues();
  var startIndex = START_ROW - 1;
  var eligible   = 0;
  Logger.log("Scanning from row " + START_ROW + " | Total rows: " + allRows.length + " | Now: " + now.toISOString());

  for (var r = startIndex; r < allRows.length; r++) {
    var row      = allRows[r];
    var checked  = row[COL_CHECKBOX];
    var queuedAt = row[COL_QUEUED_AT];
    var notified = String(row[COL_NOTIFIED]).trim().toUpperCase();
    var elapsed  = queuedAt ? Math.round((now - new Date(queuedAt)) / 60000) + " min" : "not queued";
    var skipReason = "";

    if (notified === "YES")   skipReason = "SKIP – already notified";
    else if (checked !== true) skipReason = "SKIP – checkbox not checked (value='" + checked + "')";

    if (skipReason) {
      Logger.log("  Row " + (r+1) + " | " + skipReason);
    } else {
      eligible++;
      var creatives = COL_CREATIVES.map(function(col) {
        var name  = String(row[col]).trim();
        var email = name ? (emailMap[name.toLowerCase()] || "⚠️ NOT FOUND") : "(empty)";
        return name ? name + " → " + email : "(empty)";
      });
      Logger.log("  ✅ ELIGIBLE Row " + (r+1)
        + " | project='" + String(row[COL_PROJECT_NAME]).trim() + "'"
        + " | queuedAt='" + queuedAt + "' | elapsed=" + elapsed
        + " | O:" + creatives[0] + " P:" + creatives[1]
        + " Q:" + creatives[2] + " R:" + creatives[3]);
    }
  }
  Logger.log("Eligible rows found: " + eligible);
  Logger.log("=== DEBUG END ===");
}

// ── Test helper ───────────────────────────────────────────────
/**
 * Sends a preview email for any row to YOUR inbox.
 * Change TEST_ROW_NUMBER to the row you want to preview.
 * Nothing in the sheet is modified.
 */
function sendTestEmail() {
  var TEST_ROW_NUMBER = 54;                        // ← change to any row number
  var TEST_RECIPIENT  = "shanvit1201@gmail.com";   // ← your inbox

  var ss               = SpreadsheetApp.getActiveSpreadsheet();
  var bookingsSheet    = ss.getSheetByName(BOOKINGS_SHEET);
  var contractorsSheet = ss.getSheetByName(CONTRACTORS_SHEET);
  if (!bookingsSheet || !contractorsSheet) { Logger.log("ERROR: Sheet not found."); return; }

  var allRows  = bookingsSheet.getDataRange().getValues();
  var row      = allRows[TEST_ROW_NUMBER - 1];
  if (!row) { Logger.log("ERROR: Row " + TEST_ROW_NUMBER + " not found."); return; }

  // Use the first non-empty creative name found in O–R, or a fallback
  var creativeName = "Creative";
  for (var i = 0; i < COL_CREATIVES.length; i++) {
    var n = String(row[COL_CREATIVES[i]]).trim();
    if (n) { creativeName = n; break; }
  }

  var projectName = String(row[COL_PROJECT_NAME]).trim() || "(No project name)";
  var firstName   = creativeName.split(" ")[0];

  MailApp.sendEmail({ to: TEST_RECIPIENT, subject: buildSubject(projectName), htmlBody: buildEmailBody(firstName, projectName) });
  Logger.log("Test email sent to " + TEST_RECIPIENT + " | row=" + TEST_ROW_NUMBER + " | project='" + projectName + "' | creative='" + creativeName + "'");
}

// ── One-time trigger installer ────────────────────────────────
/**
 * Run ONCE to install a 15-minute recurring trigger.
 * Safe to re-run — will not create duplicate triggers.
 */
function createTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    if (triggers[t].getHandlerFunction() === "checkBookingsAndNotify") {
      Logger.log("Trigger already exists – nothing to do."); return;
    }
  }
  ScriptApp.newTrigger("checkBookingsAndNotify").timeBased().everyMinutes(15).create();
  Logger.log("15-minute trigger created for checkBookingsAndNotify.");
}
