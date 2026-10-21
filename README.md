# UniCollab

A collaborative study platform for university students: course input and dashboard, PDF workspace, Exam Mode (AI study hub) and one-to-one AI chat. CSE327 Software Engineering project.

**Who owns which file:** see [docs/STRUCTURE.md](docs/STRUCTURE.md). Please read it before you start.

## Tech stack

React (Vite) | Node.js + Express | PostgreSQL

## Getting started

1. Install Node.js (LTS) and PostgreSQL.
2. Clone the repo and install the libraries:

```
git clone https://github.com/TabshiraIO/uniCollab.git
cd uniCollab\server
npm install
cd ..\client
npm install
```

3. Create an empty PostgreSQL database named `unicollab` (for example in pgAdmin).
4. Copy `server\.env.example` to `server\.env` and put your own PostgreSQL password in `DB_PASSWORD`. Never commit `.env`.
5. Run the server (`npm run dev` inside `server`) and the client (`npm run dev` inside `client`) in two terminals.

## Working rules

- Only edit files that belong to you.
- Work on your own branch (`feature/your-feature`) and open a pull request into `main`.
