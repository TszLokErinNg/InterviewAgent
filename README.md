## InterviewAgent – AI-Powered Interview Coach

InterviewAgent is a web app that helps you practice job interviews with an AI coach. It asks structured questions, scores your answers, highlights strengths and weaknesses, and suggests improved sample responses – all in a polished, modern UI.

The included `interview-coach` React app focuses on three main modes:

- **Behavioral / HR**: Classic STAR-style questions and coaching  
- **Automation & Control Systems**: Technical interview practice for control/automation roles  
- **Hiring Manager & Custom**: Realistic hiring manager conversations, plus a custom mode that tailors questions to your JD and resume  

You can answer by **typing** or using **voice input** (when supported by your browser), and you can switch between **dark** and **light** themes.

---

### Features

- **Structured 6-question mock interviews**
  - Questions 1–5: role-specific or behavioral questions  
  - Question 6: “Do you have any questions for me?” wrap‑up
- **Detailed AI feedback after each answer**
  - Numeric score out of 10  
  - Strengths and improvement points  
  - Sample strong answer in the same style
- **Custom Interview Mode**
  - Paste a job description and your resume  
  - The coach generates tailored questions and feedback based on that context
- **Voice Answering (where supported)**
  - Click the mic to speak your answer  
  - Transcription flows into the text box, then send as usual
- **Theme Toggle**
  - Light and dark modes with tuned colors for each category  
  - Category cards and descriptions adapt to the selected theme

---

### Tech Stack

- **Frontend**: React (Create React App)
- **Styling**: Inline styles + a few base styles from `index.css`
- **AI Model**: Google Gemini API (`generativelanguage.googleapis.com` – `gemini-flash-latest`)
- **Speech Recognition**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) when available

---

### Getting Started

From the `interview-coach` folder:

1. **Install dependencies**

   ```bash
   cd interview-coach
   npm install
   ```

2. **Configure your Gemini API key**

   Create `.env` in `interview-coach/`:

   ```text
   REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
   ```

   Make sure `.env` is **ignored by git** (already handled via `.gitignore`).

3. **Run the dev server**

   ```bash
   npm start
   ```

4. Open `http://localhost:3000` in your browser and start a session.

---

### Notes on Voice Mode

- Voice answering uses the browser’s **Web Speech API**.  
- It typically works best in **desktop Chrome** (and Chromium-based browsers).  
- If your browser doesn’t support it, the mic button may be disabled or hidden.

---

### Disclaimer

This project’s **initial layout, structure, and React template were generated using Claude** as a starting point.  
I then **added and refined the JavaScript/JSX logic, theming, Gemini API integration, and UI tweaks myself** to bring the app to life in roughly a day of focused work.