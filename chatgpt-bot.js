import fs from "fs";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { executablePath } from "puppeteer";
import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  HeadingLevel,
  TextRun,
  Packer,
} from "docx";
import path from "path";

puppeteerExtra.use(StealthPlugin());

const cookiesPath = "cookies.json";
const userDataDir = "./chrome-data";

(async () => {
  const browser = await puppeteerExtra.launch({
    headless: false,
    userDataDir: userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-extensions-except=",
      "--enable-automation=false",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    delete navigator.__proto__.webdriver;
  });

  console.log("Navigating to ChatGPT...");
  await page.goto("https://chat.openai.com/", { waitUntil: "networkidle2" });

  try {
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
      await page.setCookie(...cookies);
      console.log("Cookies loaded.");
      await page.reload({ waitUntil: "networkidle2" });
    }
  } catch (error) {
    console.log("No valid cookies found. Please log in manually.");
  }

  const isLoggedIn = await page.evaluate(() => {
    return !document.querySelector('button[data-testid="login-button"]');
  });

  if (!isLoggedIn) {
    console.log(
      "Please log in manually and press Enter in the console when done..."
    );
    await new Promise((resolve) => {
      process.stdin.once("data", (data) => {
        resolve();
      });
    });

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log("Cookies saved for future use.");
  }



  const questions = [
"6. Describe Cyber Offences under IT ACT 2000.",
"7. Write a note on Cyber terrorism.",
"8. Briefly explain the power of investigation, search and arrest mentioned under the IT ACT 2000.",
  ];




  const results = [];

  for (const question of questions) {
    console.log(`Asking: ${question}`);

    await page.type("textarea", question);
    await page.keyboard.press("Enter");

    await page.waitForFunction(
      () =>
        document.querySelector('button[aria-label="Stop streaming"]') !== null,
      { timeout: 15000 }
    );

    console.log("Response generation started...");

    await page.waitForFunction(
      () => {
        const sendButton = document.querySelector(
          'button[aria-label="Send prompt"]'
        );
        const voiceButton = document.querySelector(
          'button[aria-label="Start voice mode"]'
        );
        return sendButton !== null || voiceButton !== null;
      },
      { timeout: 120000 }
    );

    console.log("Response generation complete");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const responseText = await page.evaluate(() => {
      try {
        const messageContainers = Array.from(
          document.querySelectorAll('[data-testid="conversation-turn"]')
        );

        if (messageContainers.length > 0) {
          const lastContainer = messageContainers[messageContainers.length - 1];

          if (
            !lastContainer
              .querySelector(
                '[data-testid="conversation-turn-header"] .font-semibold'
              )
              ?.innerText.includes("You")
          ) {
            const markdown = lastContainer.querySelector(".markdown");
            if (markdown) return markdown.innerText.trim();
          }
        }

        const responseElements = Array.from(
          document.querySelectorAll(".markdown")
        );
        if (responseElements.length > 0) {
          return responseElements[responseElements.length - 1].innerText.trim();
        }

        return "Failed to extract response";
      } catch (error) {
        return `Error extracting response: ${error.message}`;
      }
    });

    // Save the question-response pair
    results.push({ question, response: responseText });

    console.log(`Response saved for: "${question}"`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n===== RESULTS =====");
  results.forEach((item, index) => {
    console.log(`\nQuestion ${index + 1}: ${item.question}`);
    console.log(`Response: ${item.response}\n`);
  });

  fs.writeFileSync("chatgpt_responses.json", JSON.stringify(results, null, 2));
  console.log("Responses saved to chatgpt_responses.json");

  await saveToWordDoc(results);

  console.log("All questions processed!");
  await browser.close();
})();

async function saveToWordDoc(results) {
  const doc = new Document({
    creator: "ChatGPT Automation",
    title: "ChatGPT Responses",
    description: "Automatically generated responses from ChatGPT",
    sections: [],
  });

  // Create array to hold document elements
  const children = [];

  results.forEach((item, index) => {
    children.push(
      new Paragraph({
        text: `Question ${index + 1}: ${item.question}`,
        heading: HeadingLevel.HEADING_2,
        spacing: {
          after: 200,
        },
        bold: true,
      })
    );

    if (item.response.includes("\t") && item.response.includes("\n")) {
      try {
        const lines = item.response.split("\n");

        const tableStartIndex = lines.findIndex((line) => line.includes("\t"));
        if (tableStartIndex > 0) {
          const textBeforeLines = lines.slice(0, tableStartIndex);

          textBeforeLines.forEach((line) => {
            if (line.trim()) {
              children.push(
                new Paragraph({
                  text: line,
                  spacing: { before: 80, after: 80 },
                })
              );
            }
          });
        }

        const tableLines = lines.filter((line) => line.includes("\t"));

        if (tableLines.length >= 1) {
          const tableData = tableLines.map((line) => line.split("\t"));

          const tableRows = tableData.map((rowData, rowIndex) => {
            return new TableRow({
              children: rowData.map((cellText) => {
                return new TableCell({
                  children: [
                    new Paragraph({
                      text: cellText,
                      bold: rowIndex === 0,
                    }),
                  ],
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                  },
                });
              }),
            });
          });

          children.push(
            new Table({
              rows: tableRows,
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
            })
          );

          const tableEndIndex = lines.lastIndexOf(
            tableLines[tableLines.length - 1]
          );
          if (tableEndIndex < lines.length - 1) {
            const textAfterLines = lines.slice(tableEndIndex + 1);

            textAfterLines.forEach((line) => {
              if (line.trim()) {
                children.push(
                  new Paragraph({
                    text: line,
                    spacing: { before: 80, after: 80 },
                  })
                );
              }
            });
          }
        } else {
          processTextWithLineBreaks(item.response, children);
        }
      } catch (error) {
        console.log("Error processing table:", error);
        processTextWithLineBreaks(item.response, children);
      }
    } else {
      processTextWithLineBreaks(item.response, children);
    }

    children.push(
      new Paragraph({
        text: "----------------------------------------",
        spacing: { before: 300, after: 300 },
      })
    );
  });

  doc.addSection({
    children: children,
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("chatgpt_responses.docx", buffer);
  console.log("Responses saved to chatgpt_responses.docx");
}

function processTextWithLineBreaks(text, children) {
  const lines = text.split("\n");

  lines.forEach((line) => {
    if (line.trim()) {
      if (line.trim().match(/^#{1,6}\s/)) {
        const level = line.match(/^(#{1,6})\s/)[1].length;
        const headingText = line.replace(/^#{1,6}\s/, "");
        children.push(
          new Paragraph({
            text: headingText,
            heading: `Heading${level + 1}`,
            spacing: { before: 200, after: 120 },
          })
        );
      }
      else if (line.trim().match(/^[•\-*]\s/)) {
        children.push(
          new Paragraph({
            text: line,
            bullet: {
              level: 0,
            },
            spacing: { before: 60, after: 60 },
          })
        );
      }
      else if (line.includes(":")) {
        const colonIndex = line.indexOf(":");
        const textBefore = line.substring(0, colonIndex).trim();
        const textAfter = line.substring(colonIndex + 1).trim();

        // Create a paragraph with mixed formatting using children array
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: textBefore + ":",
                bold: true,
              }),
              new TextRun({
                text: textAfter ? " " + textAfter : "",
              }),
            ],
          })
        );
      }
      else {
        children.push(
          new Paragraph({
            text: line,
            spacing: { before: 80, after: 80 },
          })
        );
      }
    }
  });
}
