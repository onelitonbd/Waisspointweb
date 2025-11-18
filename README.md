# Study Agent App

A Firebase-powered study application with AI tutoring capabilities.

## Setup Instructions

1. **Firebase Setup:**
   - Create a new Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Enable Hosting
   - Copy your Firebase config and replace in `js/firebase-config.js`

2. **Local Development:**
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Login: `firebase login`
   - Initialize: `firebase init` (select existing project)
   - Serve locally: `firebase serve`

3. **Deploy:**
   - `firebase deploy`

## Project Structure

```
/
├── index.html          # Main HTML file
├── css/
│   └── style.css      # Responsive CSS styles
├── js/
│   ├── firebase-config.js  # Firebase configuration
│   ├── auth.js            # Authentication module
│   └── app.js             # Main application logic
├── firebase.json          # Firebase hosting config
├── firestore.rules       # Firestore security rules
└── firestore.indexes.json # Firestore indexes
```

## Features

- ✅ Firebase Authentication (Login/Signup)
- ✅ Responsive mobile-first design
- ✅ Chat interface with sidebar navigation
- ✅ Firestore integration for data storage
- ✅ Three AI modules: Study Session, Notes, Exam
- 🔄 AI integration (ready for Gemini API)

## Next Steps

1. Replace Firebase config with your actual project credentials
2. Implement AI modules with Gemini API integration
3. Add advanced features like file uploads, voice input, etc.