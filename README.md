# vacansee 🎓

[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/built-with-resentment.svg)](https://forthebadge.com) [![forthebadge](https://forthebadge.com/images/badges/for-you.svg)](https://forthebadge.com)

A modern web application designed to help students find available rooms on campus. Built with Next.js, Prisma, and TypeScript.

## Features 🚀

- **Real-time Room Availability** - Check which rooms are currently available
- **Room Search** - Search for specific rooms and their availability
- **Visual Timetable** - View room schedules in an interactive graph
- **Automatic Updates** - Timetable data is automatically updated daily
- **Mobile Responsive** - Works seamlessly on all devices

## Tech Stack 💻

- **Frontend**: Next.js, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, [Prisma](https://www.prisma.io/orm)
- **Database**: PostgreSQL hosted on [Supabase](https://supabase.com)
- **Deployment**: [Vercel](https://vercel.com)
- **Data Updates**: [GitHub Actions](https://github.com/actions)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom animations
- **Badges**: [ForTheBadge](https://forthebadge.com)
- **AI Assistance**: [Google AI Studio](https://www.aistudio.google.com/)

## Getting Started 🏁

### Prerequisites

- Node.js 16+
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository

```bash
git clone https://github.com/tahayparker/vacansee.git
cd vacansee
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Set up environment variables

```bash
# Create a .env file with the following variables
DATABASE_URL="postgresql://username:password@localhost:5432/vacansee"
```

4. Initialize the database

```bash
npx prisma db push
```

5. Run the development server

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`

## Automatic Updates ⚡

The timetable data is automatically updated every day at 00:00 GST (04:00 UTC) using GitHub Actions. The workflow:

1. Scrapes the latest timetable data
2. Updates the database
3. Generates a new schedule JSON
4. Commits the changes

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Inspiration ✨

- Built for my friends so they can stop eating my head and finally use a website to search empty rooms
- Inspired by the need for an easier way to find available rooms

## Acknowledgments 🙏

- Thank you Mom Dad for not kicking me out of the house
- Thank you Claude & OpenAI engineers for making a really good product
- Thank you Cursor devs for making a really really amazing product, and for the free trial
- Thank you UOWD for finally getting rid of the PDF timetable and switching to the [website](https://my.uowdubai.ac.ae/timetable/viewer) instead (please keep it open for non-authenticated users, otherwise this project will die </3)

## Contact 📧

Taha Parker - [@tahayparker](https://github.com/tahayparker)

Project Link: [https://github.com/tahayparker/vacansee](https://github.com/tahayparker/vacansee)

[![forthebadge](https://forthebadge.com/images/badges/open-source.svg)](https://forthebadge.com)[![forthebadge](https://forthebadge.com/images/badges/powered-by-black-magic.svg)](https://forthebadge.com)[![forthebadge](https://forthebadge.com/images/badges/it-works-dont-ask-me-how.svg)](https://forthebadge.com)
