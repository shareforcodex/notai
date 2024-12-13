# Notion Editor WebApp

![App Screenshot](path/to/screenshot.png)

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [AI Integration](#ai-integration)
- [Folder and Note Management](#folder-and-note-management)
- [Comments and Collaboration](#comments-and-collaboration)
- [Customization](#customization)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Welcome to the **Notion Editor WebApp**, a powerful and intuitive web-based text editor designed to enhance your productivity and streamline your note-taking experience. Whether you're drafting documents, organizing thoughts, or managing projects, our editor offers a seamless and feature-rich environment to cater to all your writing needs.

Built with modern web technologies, the Notion Editor WebApp integrates advanced AI capabilities to assist you in generating, correcting, and translating your content, making your workflow smarter and more efficient.

## Features

- **Rich Text Editing:** Create and format text with ease using a comprehensive set of formatting tools.
- **AI-Powered Assistance:** Utilize AI models to ask questions, correct grammar, and translate text directly within the editor.
- **Custom AI Tools:** Add and configure custom AI tools tailored to your specific needs.
- **Source View Toggle:** Switch between the WYSIWYG editor and the raw HTML source for advanced editing.
- **Auto-Save:** Automatically save your work at regular intervals to prevent data loss.
- **Comments and Annotations:** Add comments to specific sections of your text for better collaboration and feedback.
- **Folder and Note Management:** Organize your notes into folders for easy access and management.
- **Media Insertion:** Insert images, audio, video, and iframes to enrich your content.
- **Table of Contents:** Generate and navigate through a table of contents based on your document's headings.
- **User Authentication:** Secure login and registration system to protect your notes and settings.
- **Responsive Design:** Access your editor from any device with a responsive and adaptive layout.

## Getting Started

### Prerequisites

Before you begin, ensure you have met the following requirements:

- **Web Browser:** A modern web browser (e.g., Chrome, Firefox, Safari, Edge) with JavaScript enabled.
- **Internet Connection:** Required for API calls and AI integrations.
- **Node.js and npm (Optional):** If you plan to run a local development server or make customizations.

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/notion-editor-webapp.git
   ```

2. **Navigate to the Project Directory:**

   ```bash
   cd notion-editor-webapp
   ```

3. **Install Dependencies (If Applicable):**

   If your project uses package managers like npm or yarn, install the necessary dependencies:

   ```bash
   npm install
   ```

4. **Configure API Endpoints:**

   Ensure that the `API_BASE_URL` in `script.js` points to your backend server:

   ```javascript
   const API_BASE_URL = "https://your-api-endpoint.com";
   ```

5. **Run the Application:**

   You can open the `index.html` file directly in your browser or use a local development server for better performance.

   ```bash
   # Using a simple HTTP server with Python
   python -m http.server 8000
   ```

   Then, navigate to `http://localhost:8000` in your web browser.

## Usage

1. **Register an Account:**

   - Click on the **Register** button.
   - Provide your **User ID**, **Password**, and **Email**.
   - Submit the form to create your account.

2. **Login:**

   - Enter your **User ID** and **Password**.
   - Click on the **Login** button to access your dashboard.

3. **Creating and Managing Notes:**

   - **Create a New Note:** Click on the **New Page** button to create a new note.
   - **Organize with Folders:** Use the **New Folder** button to create folders and organize your notes.
   - **Edit Notes:** Click on any note to open it in the editor. Use the formatting toolbar to style your text.
   - **Auto-Save:** Your changes are automatically saved every 10 seconds.

4. **Using AI Features:**

   - **AI Toolbar:** Select text and use the AI toolbar to ask questions, correct grammar, or translate content.
   - **Custom Tools:** Access additional AI tools you've configured in the settings.

5. **Comments and Collaboration:**

   - **Add Comments:** Highlight text and click the **Add Comment** button to annotate specific sections.
   - **Edit/Delete Comments:** Click on commented text to view, edit, or delete comments.

6. **Media Insertion:**

   - **Insert Images, Audio, Video, Iframes:** Use the respective buttons to embed media into your notes.

7. **Table of Contents:**

   - **Generate TOC:** Click on the **Toggle TOC** button to view a table of contents based on your headings.
   - **Navigate:** Click on any TOC entry to jump to that section in your document.

## AI Integration

The Notion Editor WebApp integrates multiple AI models to assist you in various tasks:

- **Ask:** Generate answers to your questions based on the selected text.
- **Correct:** Automatically correct grammar and spelling errors.
- **Translate:** Translate selected text to English or other languages.
- **Custom Tools:** Add and configure your own AI tools with custom prompts.

### Selecting AI Models

1. **Access AI Settings:**

   - Click on the **AI Settings** button in the toolbar.

2. **Choose Models:**

   - Select from the default AI models or add new ones by providing the **Model Name**, **Model ID**, **API URL**, and **API Key**.

3. **Configure Preferences:**

   - Assign specific models to different AI tool buttons for personalized assistance.

## Folder and Note Management

- **Create Folders:** Organize your notes into folders for better structure.
- **Add Notes to Folders:** Assign notes to specific folders during creation or editing.
- **View Folder Contents:** Click on a folder to view and manage its notes and sub-folders.
- **Search and Filter:** Easily find notes within folders using the search functionality.

## Comments and Collaboration

Enhance collaboration by adding comments to specific parts of your notes:

- **Add Comments:** Select text and click the **Add Comment** button to annotate.
- **View Comments:** Click on commented text to view existing comments.
- **Edit/Delete Comments:** Modify or remove comments as needed.

## Customization

Tailor the editor to your preferences:

- **AI Prompts:** Customize AI prompts for different actions in the AI settings.
- **Formatting Tools:** Use the toolbar to format text, insert media, and manage content structure.
- **Themes and Styles:** (If applicable) Choose from different themes or customize the editor's appearance.

## Contributing

Contributions are welcome! If you'd like to contribute to the Notion Editor WebApp, please follow these steps:

1. **Fork the Repository:**

   Click the **Fork** button at the top right of the repository page.

2. **Create a New Branch:**

   ```bash
   git checkout -b feature/YourFeatureName
   ```

3. **Make Your Changes:**

   Implement your feature or bug fix.

4. **Commit Your Changes:**

   ```bash
   git commit -m "Add Your Feature"
   ```

5. **Push to the Branch:**

   ```bash
   git push origin feature/YourFeatureName
   ```

6. **Open a Pull Request:**

   Go to the repository on GitHub and click **Compare & pull request**.

## License

This project is licensed under the [MIT License](LICENSE).
