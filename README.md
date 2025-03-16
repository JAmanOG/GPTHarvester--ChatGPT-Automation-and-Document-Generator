# GPTHarvester

A desktop application that automates interactions with ChatGPT, allowing you to batch process multiple questions and save responses as both JSON and Word documents.

## Features

- **Batch Processing**: Submit multiple questions to ChatGPT in sequence
- **Question Management**: Save, load, and manage sets of questions for reuse
- **Document Generation**: Automatically convert ChatGPT responses into formatted Word documents
- **Progress Tracking**: Real-time progress updates during automation
- **Export Options**: Save responses as JSON or Word documents
- **Profile Management**: Create and manage Chrome profiles for ChatGPT authentication

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/JAmanOG/GPTHarvester--ChatGPT-Automation-and-Document-Generator.git
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

## Usage

### Setting Up

1. Navigate to the **Settings** tab
2. Set the path to your Chrome executable
3. Click "Setup Chrome Profile" if this is your first time using the application
4. Follow the prompts to log in to your ChatGPT account when the browser opens

### Processing Questions

1. Go to the **Questions** tab
2. Enter your questions (one per line) in the text area
3. Click "Run Automation" to start processing
4. Monitor progress in the status bar at the bottom

### Managing Question Sets

- Click "Save Questions" to create a reusable question set
- Use the sidebar to load or delete previously saved question sets

### Viewing Results

- The **Results** tab will display responses once processing is complete
- Use the buttons at the top to:
  - Open the generated Word document
  - Open the results folder
  - Copy all results as JSON

## Requirements

- Google Chrome installed
- OpenAI account with access to ChatGPT
- Windows/macOS operating system

## Technical Details

Built with:
- Electron
- Puppeteer for web automation
- docx for Word document generation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC License

## Author

Developed by Aman Jaiswal | [LinkedIn](https://www.linkedin.com/in/aman-jaiswalg)

---

For issues and feature requests, please [open an issue](https://github.com/JAmanOG/GPTHarvester--ChatGPT-Automation-and-Document-Generator/issues) on GitHub.