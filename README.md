# ThoughtSort - AI Voice Notes & Smart To-Do App

> **PRD Implementation**: Draft v1 (16 November 2026)  
> **Status**: Complete & Ready to Run  
> **Tech Stack**: HTML5, Modern JavaScript (ES6+), Web Audio API, Web Speech API, Tailwind CSS, Lucide Icons, Node.js (Static Server)

---

## 🌟 Overview
**ThoughtSort** turns messy, mixed-up brain dumps into structured, categorized items with zero manual sorting friction.

Whether spoken through the microphone or typed in quiet places, ThoughtSort transcribes the input, understands individual thoughts, extracts due dates and times, determines priority and tags, and organizes everything into the 5 PRD categories:
1. **Tasks** (actionable items with deadlines & priorities)
2. **Reminders** (time-sensitive errands with snooze & alert triggers)
3. **Goals / Learning** (longer-term aspirations, learning courses, habits)
4. **Ideas** (creative thoughts, with 1-click "Promote to Task" workflow)
5. **Notes** (reference notes, general informational thoughts)

---

## 🚀 Quick Start

### Option 1: Direct Browser Launch
Open `index.html` directly in any modern browser (Chrome, Edge, Safari, Firefox):
```powershell
explorer.exe "C:\Users\Aashna\.gemini\antigravity\scratch\thoughtsort-web\index.html"
```

### Option 2: Run with Built-in Lightweight Local Server
```powershell
cd "C:\Users\Aashna\.gemini\antigravity\scratch\thoughtsort-web"
node server.js
```
Then visit **`http://localhost:3000`** in your browser.

---

## 📋 PRD Functional Requirements Matrix (100% Satisfied)

| PRD ID | Requirement | Priority | Implementation in this App |
| :--- | :--- | :---: | :--- |
| **FR-1** | One-tap microphone button to start/stop recording | **P0** | Web Speech API + Web Audio API visualizer + pulsing mic button |
| **FR-2** | Speech-to-text transcription of recording | **P0** | Real-time voice transcription into the brain dump workspace |
| **FR-3** | Text input box as alternative to voice | **P0** | Auto-resizing textarea with keyboard shortcut (`Ctrl+Enter`) |
| **FR-4** | Live / post-recording transcript user can edit | **P1** | Editable before processing & during review |
| **FR-5** | Save original audio file linked to generated items | **P1** | Audio recorder captures voice snippet; replay button on cards |
| **FR-6** | Split transcript into distinct items (one thought = one item) | **P0** | Natural language boundary & conjunction parser |
| **FR-7** | Classify items into Task, Reminder, Idea, Goal, Note | **P0** | Semantic classification engine with 5 distinct category colors & badges |
| **FR-8** | Extract due dates & times from natural language | **P0** | Detects "tomorrow", "today at 6 PM", "next week", "Friday 3 PM" |
| **FR-9** | Assign priority (High / Medium / Low) based on urgency | **P1** | Urgency cue evaluation and deadline proximity scoring |
| **FR-10**| Rewrite each item as short clean title | **P1** | Strips conversational filler phrases ("I need to...", "I have to...") |
| **FR-11**| Auto-tag items (#college, #shopping, #learning) | **P2** | Dynamic domain keyword tagger with interactive tag cloud |
| **FR-12**| Show confidence flag on classifications | **P2** | Percentage match & confidence flags on review screen |
| **FR-13**| Review screen with edit/delete before saving | **P0** | Interactive modal showing proposed items with full live editing |
| **FR-14**| 5 Category views + counters | **P0** | Filter tabs with live badge counters for each category |
| **FR-15**| Today & Upcoming views sorted by due date | **P1** | Dedicated timeline navigation (Today, Upcoming, Completed) |
| **FR-16**| Mark complete, edit, and delete items | **P0** | Checkbox toggles, edit modal, delete actions with undo/toast |
| **FR-17**| Keyword search across items and transcripts | **P1** | Real-time global search bar (desktop & mobile) |
| **FR-18**| Convert item between categories (Idea &rarr; Task) | **P1** | 1-click "Promote to Task" button + category switcher dropdown |
| **FR-19**| Notification at due time for reminders | **P0** | In-app alert modal + Web Audio synthesized chime + Web Notifications |
| **FR-20**| Optional advance alert | **P2** | Upcoming deadline tracking |
| **FR-21**| Snooze and dismiss reminders | **P2** | 10-minute snooze & dismiss controls |
| **FR-22**| Persist items, transcripts locally | **P0** | Automatic `localStorage` persistence |
| **FR-23**| Export items to text, CSV, or JSON | **P2** | 1-click export to CSV spreadsheet, JSON database, and Markdown |

---

## 🧪 Testing the PRD Page 1 Example

The app comes pre-seeded with the exact example from Page 1 of your PRD:
> *"I have to complete my Java assignment by tomorrow. I also need to buy groceries today at 6 PM. I have been thinking about starting a machine learning course next week. Also, I have an idea for a new college project."*

You can also test this live at any time by clicking the **"🎓 College PRD Note"** preset button at the top of the app!
