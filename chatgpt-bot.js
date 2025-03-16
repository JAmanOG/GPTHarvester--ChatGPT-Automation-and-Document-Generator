const fs = require("fs");
const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const {
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
} = require("docx");
const path = require("path");
const executablePath = require("puppeteer").executablePath;

// puppeteerExtra.use(StealthPlugin());
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("iframe.contentWindow");
stealth.enabledEvasions.delete("media.codecs");
puppeteerExtra.use(stealth);

const userDataDir = path.join(__dirname, "chrome-data");
const cookiesPath = path.join(__dirname, "cookies.json");

async function avoidCloudflare(page) {
  const randomDelay = (min, max) => {
    const delay = Math.floor(Math.random() * (max - min) + min);
    return new Promise((resolve) => setTimeout(resolve, delay));
  };

  await page.goto("https://openai.com/", { waitUntil: "networkidle2" });
  await randomDelay(2000, 4000);

  await page.evaluate(() => {
    window.scrollTo({
      top: 100,
      behavior: "smooth",
    });
  });
  await randomDelay(1000, 2000);

  await page.goto("https://chat.openai.com/", {
    waitUntil: "networkidle2",
    timeout: 60000,
  });
}

function isProfileReady() {
  if (!fs.existsSync(userDataDir)) return false;

  const files = fs.readdirSync(userDataDir);
  return (
    files.includes("Default") ||
    files.includes("Preferences") ||
    files.includes("Local State")
  );
}

async function setupChromeProfile(chromePath) {
  try {
    console.log("Creating a fresh Chrome profile for ChatGPT...");
    console.log(`Using Chrome from: ${chromePath}`);

    if (fs.existsSync(userDataDir)) {
      console.log("Removing existing problematic profile...");
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }

    console.log("Creating fresh Chrome profile...");
    fs.mkdirSync(userDataDir, { recursive: true });

    const browser = await puppeteerExtra.launch({
      headless: false,
      userDataDir: userDataDir,
      dumpio: true,
      args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
      ignoreHTTPSErrors: true,
      executablePath: chromePath,
    });
    console.log("Browser launched successfully");
    const page = await browser.newPage();
    console.log("New page created");

    // Navigate directly to ChatGPT
    await page.goto("https://chat.openai.com/", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("Please log in to ChatGPT in the browser window");

    await page.waitForFunction(
      () => {
        return (
          !document.querySelector('button[data-testid="login-button"]') &&
          document.querySelector("textarea") !== null
        );
      },
      { timeout: 300000 }
    );

    console.log("Login detected successfully");
    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log(`Cookies saved to ${path.resolve(cookiesPath)}`);

    await browser.close();
    return true;
  } catch (error) {
    console.error("Error creating Chrome profile:", error);
    return false;
  }
}

async function runChatGPTAutomation(questions, options = {}) {
  if (!isProfileReady()) {
    console.log(
      "No valid Chrome profile found. Setting up new profile first..."
    );
    const chromePath =
      options.chromePath ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe";
    await setupChromeProfile(chromePath);
  }
  const chromePath =
    options.chromePath ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const progressCallback = options.progressCallback || (() => {});

  progressCallback({
    status: "starting",
    progress: 0,
    message: "Launching browser...",
  });

  const browser = await puppeteerExtra.launch({
    headless: false,
    userDataDir: userDataDir,
    dumpio: true,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: chromePath,
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
  );

  progressCallback({
    status: "navigating",
    progress: 10,
    message: "Navigating to ChatGPT...",
  });

  await page.setDefaultNavigationTimeout(120000); // Increase timeout to 2 minutes
  await new Promise((r) => setTimeout(r, 3000)); // Wait 3 seconds before navigating
  await page.goto("https://chat.openai.com/", { waitUntil: "networkidle2" });

  try {
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
      await page.setCookie(...cookies);
      progressCallback({
        status: "cookies",
        progress: 20,
        message: "Cookies loaded.",
      });
      await page.reload({ waitUntil: "networkidle2" });
    }
  } catch (error) {
    progressCallback({
      status: "login-required",
      progress: 20,
      message: "No valid cookies found. Please log in manually.",
    });
  }

  const isLoggedIn = await page.evaluate(() => {
    return !document.querySelector('button[data-testid="login-button"]');
  });

  if (!isLoggedIn) {
    progressCallback({
      status: "login-required",
      progress: 20,
      message: "Please log in manually in the browser window...",
    });

    await new Promise((resolve) => {
      const checkLogin = setInterval(async () => {
        const loggedIn = await page.evaluate(() => {
          return !document.querySelector('button[data-testid="login-button"]');
        });

        if (loggedIn) {
          clearInterval(checkLogin);
          resolve();
        }
      }, 20000);
    });

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    progressCallback({
      status: "cookies-saved",
      progress: 30,
      message: "Cookies saved for future use.",
    });
  }

  const results = [];
  progressCallback({
    status: "processing",
    progress: 30,
    message: "Starting to process questions...",
  });

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNumber = i + 1;
    const percentComplete = 30 + Math.floor((i / questions.length) * 60);

    progressCallback({
      status: "question",
      progress: percentComplete,
      currentQuestion: questionNumber,
      totalQuestions: questions.length,
      message: `Processing question ${questionNumber}/${
        questions.length
      }: ${question.substring(0, 30)}...`,
    });

    await page.type("textarea", question);
    await page.keyboard.press("Enter");

    await page
      .waitForFunction(
        () =>
          document.querySelector('button[aria-label="Stop streaming"]') !==
          null,
        { timeout: 15000 }
      )
      .catch(() => {
        progressCallback({
          status: "error",
          message: `Timeout waiting for response to start for question ${questionNumber}`,
        });
      });

    await page
      .waitForFunction(
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
      )
      .catch(() => {
        progressCallback({
          status: "error",
          message: `Timeout waiting for response to complete for question ${questionNumber}`,
        });
      });

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

    results.push({ question, response: responseText });
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  progressCallback({
    status: "saving",
    progress: 90,
    message: "Saving results...",
  });

  fs.writeFileSync("chatgpt_responses.json", JSON.stringify(results, null, 2));
  await saveToWordDoc(results);

  progressCallback({
    status: "finished",
    progress: 100,
    message: "All questions processed!",
  });
  await browser.close();

  return results;
}

async function saveToWordDoc(results) {
  const doc = new Document({
    creator: "ChatGPT Automation",
    title: "ChatGPT Responses",
    description: "Automatically generated responses from ChatGPT",
    sections: [],
  });

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

// function processTextWithLineBreaks(text, children) {
//   const lines = text.split("\n");

//   lines.forEach((line) => {
//     if (line.trim()) {
//       if (line.trim().match(/^#{1,6}\s/)) {
//         const level = line.match(/^(#{1,6})\s/)[1].length;
//         const headingText = line.replace(/^#{1,6}\s/, "");
//         children.push(
//           new Paragraph({
//             text: headingText,
//             heading: `Heading${level + 1}`,
//             spacing: { before: 200, after: 120 },
//           })
//         );
//       } else if (line.trim().match(/^[•\-*]\s/)) {
//         children.push(
//           new Paragraph({
//             text: line,
//             bullet: {
//               level: 0,
//             },
//             spacing: { before: 60, after: 60 },
//           })
//         );
//       } else if (line.includes(":")) {
//         const colonIndex = line.indexOf(":");
//         const textBefore = line.substring(0, colonIndex).trim();
//         const textAfter = line.substring(colonIndex + 1).trim();

//         // Create a paragraph with mixed formatting using children array
//         children.push(
//           new Paragraph({
//             spacing: { before: 80, after: 80 },
//             children: [
//               new TextRun({
//                 text: textBefore + ":",
//                 bold: true,
//               }),
//               new TextRun({
//                 text: textAfter ? " " + textAfter : "",
//               }),
//             ],
//           })
//         );
//       } else if (line.includes("–")) {
//         const colonIndex = line.indexOf("–");
//         const textBefore = line.substring(0, colonIndex).trim();
//         const textAfter = line.substring(colonIndex + 1).trim();

//         // Create a paragraph with mixed formatting using children array
//         children.push(
//           new Paragraph({
//             spacing: { before: 80, after: 80 },
//             children: [
//               new TextRun({
//                 text: textBefore + "–",
//                 bold: true,
//               }),
//               new TextRun({
//                 text: textAfter ? " " + textAfter : "",
//               }),
//             ],
//           })
//         );
//       } else {
//         children.push(
//           new Paragraph({
//             text: line,
//             spacing: { before: 80, after: 80 },
//           })
//         );
//       }
//     }
//   });
// }

function processTextWithLineBreaks(text, children) {
  // First split the text into paragraphs (separated by double newlines)
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    // Skip empty paragraphs
    if (!paragraph.trim()) return;

    // Process each paragraph
    const lines = paragraph.split("\n");

    lines.forEach((line, lineIndex) => {
      if (!line.trim()) return; // Skip empty lines

      if (line.trim().match(/^#{1,6}\s/)) {
        // Handle headings
        const level = line.match(/^(#{1,6})\s/)[1].length;
        const headingText = line.replace(/^#{1,6}\s/, "");
        children.push(
          new Paragraph({
            text: headingText,
            heading: `Heading${level + 1}`,
            spacing: { before: 200, after: 120 },
          })
        );
      } else if (line.trim().match(/^[•\-*]\s/)) {
        // Handle bullet points
        children.push(
          new Paragraph({
            text: line,
            bullet: { level: 0 },
            spacing: { before: 60, after: 60 },
          })
        );
      } else if (line.includes(":")) {
        // Handle key-value pairs
        const colonIndex = line.indexOf(":");
        const textBefore = line.substring(0, colonIndex).trim();
        const textAfter = line.substring(colonIndex + 1).trim();

        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({ text: textBefore + ":", bold: true }),
              new TextRun({ text: textAfter ? " " + textAfter : "" }),
            ],
          })
        );
      } else if (line.includes("-")) {
        // Handle dash separators
        const dashIndex = line.indexOf("-");
        const textBefore = line.substring(0, dashIndex).trim();
        const textAfter = line.substring(dashIndex + 1).trim();

        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({ text: textBefore + "-", bold: true }),
              new TextRun({ text: textAfter ? " " + textAfter : "" }),
            ],
          })
        );
      } else {
        // Handle regular text
        const spacing = {
          before: lineIndex === 0 ? 120 : 40, // More space before first line of paragraph
          after: lineIndex === lines.length - 1 ? 120 : 40, // More space after last line
        };

        children.push(new Paragraph({ text: line, spacing }));
      }
    });

    // Add extra spacing between paragraphs
    if (paragraphIndex < paragraphs.length - 1) {
      children.push(
        new Paragraph({
          text: "",
          spacing: { before: 100, after: 100 },
        })
      );
    }
  });
}

module.exports = { runChatGPTAutomation, setupChromeProfile };
