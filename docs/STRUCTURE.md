# UniCollab: project structure and ownership

Owners: **[D]** Course + Dashboard, **[P]** PDF, **[E]** Exam Mode, **[C]** AI Chat (Tabshira), **[S]** Shared (tell the group before editing)

```
unicollab/
├── README.md                              [S]
├── .gitignore                             [S]
├── docs/                                  [S] proposal, notes, this file
├── server/                                Node + Express + PostgreSQL
│   ├── .env.example                       [S] copy to .env, never commit .env
│   ├── package.json                       [S]
│   └── src/
│       ├── index.js                       [S] starts the server, connects all routes
│       ├── db/
│       │   ├── pool.js                    [S] the database connection
│       │   └── schema/
│       │       ├── 01_users_courses.sql   [D] users, courses (notes)
│       │       ├── 02_pdfs_annotations.sql [P] pdfs, annotations
│       │       ├── 03_exam.sql            [E] exam plans
│       │       └── 04_chats.sql           [C] chats, messages
│       ├── routes/                        URL addresses
│       │   ├── courses.js [D]   pdfs.js [P]   exam.js [E]   chats.js [C]
│       ├── controllers/                   logic behind each address
│       │   ├── courses.js [D]   pdfs.js [P]   exam.js [E]   chats.js [C]
│       └── services/
│           └── llm.js                     [C] AI call, Exam Mode reuses it
└── client/                                React + Vite
    └── src/
        ├── main.jsx                       [S] starts React
        ├── App.jsx                        [S] decides which page shows
        ├── pages/                         one full screen each
        │   ├── Dashboard.jsx [D]   PdfWorkspace.jsx [P]
        │   └── ExamMode.jsx [E]    Chat.jsx [C]
        ├── components/                    reusable pieces
        │   └── dashboard/ [D]   pdf/ [P]   exam/ [E]   chat/ [C]
        └── api/                           functions that call the server
            └── courses.js [D]   pdfs.js [P]   exam.js [E]   chats.js [C]
```

## Where each kind of code goes

- Screen layout: your file in `pages/`, plus pieces in your `components/` folder
- Calling the server from React: your file in `client/src/api/`
- The web address your feature answers on: your file in `server/src/routes/`
- What happens when that address is called: your file in `server/src/controllers/`
- Your database tables: your numbered `.sql` file in `server/src/db/schema/`

## Rules

1. Only edit files tagged with your own letter. Need a change elsewhere? Message the owner.
2. Shared [S] files are changed by one person, after telling the group.
3. Work on your own branch (for example `feature/pdf`) and merge through a pull request, never straight to `main`.
