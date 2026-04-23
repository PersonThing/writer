// Portfolio content catalog. One source of truth for metadata used by the
// homepage tiles and category list pages. The body of each piece still
// lives in its .md file; this file adds the structured metadata (thumbnail,
// description, ordering intent) that would otherwise be scattered across
// hardcoded arrays in components or duplicated into every md frontmatter.
//
// Shape:
//   CATALOG[categorySlug] = {
//     label, blurb, viewMore,   // used by the homepage section
//     pieces: [
//       { slug, title, description, thumbnail },
//       ...                      // order here is the display order
//     ]
//   }
//
// - `slug` matches the file slug under content/portfolio/<category>/<slug>.md
// - `thumbnail` is an absolute public path (/portfolio/images/...)
// - `description` shows as the tile/list subtitle; if omitted, the piece's
//   `lede` (from md frontmatter) or first body line is used as a fallback.
// - `publishedIn` and `publishedAt` (optional) surface the venue/date on
//   list tiles and at the bottom of the article page.

const IMG = (id) => `/portfolio/images/${id}`

export const CATALOG = {
  copywriting: {
    label: 'Copywriting',
    blurb:
      'Watches Of Switzerland collaborates with its brand partners Grand Seiko and Tag Heuer for its custom content program called Anytime Anywhere. I lead its distribution across the in-house social media pages and on-site copy presence.',
    viewMore: null,
    pieces: [
      {
        slug: 'grand-seiko-film',
        title: 'Grand Seiko Film',
        thumbnail: IMG('663ee7_052cb7c61d0648339e38852fa79551af~mv2.jpg'),
      },
      {
        slug: 'tag-heuer-film',
        title: 'Tag Heuer Film',
        thumbnail: IMG('663ee7_6ae55d6c83094ba2bc24b5e13ac87e29~mv2.jpg'),
      },
    ],
  },

  'creative-direction': {
    label: 'Creative Direction',
    blurb:
      'End-to-end delivery from concept to shoot to merchandising in accordance with the themes of the annual content calendar to surface the high performing inventory across the 14 different product categories.',
    viewMore: '/creative-direction',
    pieces: [
      {
        slug: 'ethnicwear-db',
        title: 'Amazon Designer Boutique',
        thumbnail: IMG('663ee7_a5097ef05be94683bbb17a74fb7aaa03~mv2.jpg'),
      },
      {
        slug: 'style-in-the-city',
        title: 'Style in the City',
        thumbnail: IMG('663ee7_19c73452b3574e2096fb6f467db582a1~mv2.jpg'),
      },
      {
        slug: 'seasonal-campaigns',
        title: 'Seasonal Campaigns',
        thumbnail: IMG('663ee7_9dabb2e6f8184452a79b5fbaeefeb474~mv2.jpg'),
      },
      {
        slug: 'end-of-season-sale',
        title: 'End of Season Sale',
        thumbnail: IMG('663ee7_cf56f5e705a94105bc3125917a60040c~mv2.jpg'),
      },
      {
        slug: 'the-great-indian-wedding',
        title: 'The Great Indian Wedding',
        thumbnail: IMG('663ee7_51c958150ebd4682bf980df2dc06f6e3~mv2.jpg'),
      },
      {
        slug: 'dress-for-the-job-you-want',
        title: 'Work-wear Store',
        thumbnail: IMG('663ee7_15859ebb5958468582814c16f6e87aa3~mv2.jpg'),
      },
      {
        slug: 'fableisure',
        title: 'Fab-leisure',
        thumbnail: IMG('663ee7_98e1b85334ac49ea9390c46aaf1e8634~mv2.jpg'),
      },
    ],
  },

  'fashion-editorial': {
    label: 'Fashion Editorial',
    blurb:
      "Op-Eds and Columns written for The Hindu, the-Sunday-guardian, Harper's Bazaar on trends impacting the Indian sub-continent. Also includes Trend Forecasts for Amazon India with certain parts redacted for confidentiality.",
    viewMore: '/fashion-editorial',
    pieces: [
      {
        slug: 'azzedine-alaia--master-and-maverick',
        title: 'Azzedine Alaia: Master & Maverick',
        description: 'Obituary',
        publishedIn: 'The Hindu',
        publishedAt: 'November 2017',
        thumbnail: IMG('663ee7_08f7f8e6db7e4d47a29dc73dbf8dfb84~mv2.png'),
      },
      {
        slug: 'you-dont-need-to-be-a-wizard-to-pull-off-a-cape-this-winter',
        title: "You don’t need to be a wizard to pull off a cape this winter",
        description: 'Trend story',
        publishedIn: 'The Sunday Guardian',
        publishedAt: 'November 2014',
        thumbnail: IMG('663ee7_b10f3f0e1ba64995ad8a821ff939e429~mv2.png'),
      },
      {
        slug: 'fashion-weak-is-it',
        title: 'Fashion Weak, Is It?',
        description: 'A critical look at India Fashion Week',
        publishedIn: 'The Hindu Business Line',
        publishedAt: 'April 2016',
        thumbnail: IMG('663ee7_a6798de174b647e78c6624988f6798fc~mv2.png'),
      },
      {
        slug: 'manish-arora-at-paris-fashion-week',
        title: 'Manish Arora at Paris Fashion Week',
        description: 'News report',
        publishedIn: "Harper's Bazaar",
        publishedAt: 'September 2012',
        thumbnail: IMG('663ee7_291ca3aca9484ebb8a4d641ba901b7f3~mv2.jpg'),
      },
      {
        slug: 'bazaar-runway',
        title: 'Runway Trend Report F/W 2012',
        publishedIn: "Harper's Bazaar",
        publishedAt: 'August 2012',
        thumbnail: IMG('663ee7_4e138ba304cf44a5a42fe0fb1ea3f744~mv2.jpg'),
      },
      {
        slug: 'bespoke-for-the-masses',
        title: 'Bespoke for the masses',
        description: 'The evolution of the Indian fashion marketplace',
        publishedIn: 'The Hindu',
        publishedAt: 'June 2016',
      },
      {
        slug: 'lecoanet-hemant-4-decades-in-fashion',
        title: 'Lecoanet Hemant: 4 Decades In Fashion',
        description: 'A retrospective',
        publishedIn: 'Luxpresso.com',
        publishedAt: 'February 2017',
      },
      {
        slug: 'up-close-with-danilo-venturi',
        title: 'Up Close With Danilo Venturi',
        description: 'Interview with the director of IED Florence',
        publishedIn: 'FFT',
        publishedAt: 'March 2015',
        thumbnail: IMG('663ee7_54788c9143894fbdba153b6c16b91aec~mv2.jpg'),
      },
      {
        slug: 'trend-forecast-ss18',
        title: 'Trend Forecast SS18',
        description: 'Seasonal predictive report, Womenswear',
        publishedIn: 'Amazon Fashion',
        publishedAt: '2018',
        thumbnail: IMG('663ee7_175fbb891f9544c3b44d072f4be413c1~mv2.jpg'),
      },
      {
        slug: 'trend-forecast-aw18',
        title: 'Trend Forecast AW18',
        description: 'Seasonal predictive report, Menswear',
        publishedIn: 'Amazon Fashion',
        publishedAt: '2018',
        thumbnail: IMG('663ee7_54ec806f4ef24746b8cd8de9ca41f4c6~mv2.png'),
      },
      {
        slug: 'clothing---an-exercise-in-mythmaking',
        title: 'Clothing — An exercise in mythmaking',
        description: 'Critical trend story',
        publishedIn: 'The Hindu',
        publishedAt: 'July 2017',
        thumbnail: IMG('663ee7_a5c37190ab074d3dbd99cead935ae3e6~mv2.jpg'),
      },
      {
        slug: 'weaving-tradition-and-modernity',
        title: 'Weaving tradition and modernity',
        description: 'Banaras as a textile hub, a report',
        publishedIn: 'FFT',
        publishedAt: 'March 2015',
        thumbnail: IMG('663ee7_4b235ba585894e38ab3839ee0d3910fc~mv2.jpg'),
      },
    ],
  },

  editorial: {
    label: 'Editorial',
    blurb:
      'Cultural critique of the Indian zeitgeist ranging from 2010s to 2018. Includes political & feminist criticism, author interviews and pop-culture commentary.',
    viewMore: '/editorial',
    pieces: [
      {
        slug: 'weekend-watch-coming-of-rage-with-i-may-destroy-you',
        title: 'Coming-of-rage with I May Destroy You',
        description: 'A review',
        publishedIn: 'The Hindu',
        publishedAt: '2020',
        thumbnail: IMG('663ee7_4af351a4600b45cf9db26f24e7d55327~mv2.png'),
      },
      {
        slug: 'as-news-gets-compromised-for-clicks-3-saviours-rise-to-the-challenge',
        title: 'As news gets compromised for clicks, 3 saviours rise',
        description: 'Investigative report',
        publishedIn: 'MensXP.com',
        publishedAt: 'April 2017',
        thumbnail: IMG('663ee7_368c7b4d2d69484294d27c1d938d5f06~mv2.png'),
      },
      {
        slug: 'its-time-for-a-period-of-change-at-workplace',
        title: "It’s time for a period of change at workplace",
        description: 'Op-Ed',
        publishedIn: 'Business Standard',
        publishedAt: 'May 2017',
        thumbnail: IMG('663ee7_f44e73db98c24a9f8ea420578c995067~mv2.png'),
      },
      {
        slug: 'lets-talk-about-masculinity-one-closet-at-a-time',
        title: 'Masculinity, One Closet at a Time',
        description: 'Longform feature',
        publishedIn: 'MensXP.com',
        publishedAt: 'March 2017',
      },
      {
        slug: 'the-kharab-uprising',
        title: 'The KhArab Uprising',
        description: '#NotInMyName protests in New Delhi',
        publishedIn: 'MensXP.com',
        publishedAt: 'July 2017',
      },
      {
        slug: 'death-in-the-gunj',
        title: 'Death In The Gunj',
        description: 'Movie review',
        publishedIn: 'MensXP.com',
        publishedAt: '2016',
      },
      {
        slug: 'can-the-mr-gay-world-pageant-rescue-the-reputation-of-beauty-pageants',
        title: 'The Mr GAY World Pageant',
        description: 'Longform feature',
        publishedIn: 'MensXP.com',
        publishedAt: '2017',
      },
      {
        slug: 'all-hail-the-taxi',
        title: 'All Hail The Taxi',
        description: 'Cover story',
        publishedIn: 'The Hindu Business Line',
        publishedAt: 'August 2016',
      },
      {
        slug: 'where-to-meet-delhis-pilots-paupers-and-princeton-dudes',
        title: 'How To Meet A Guy in 10 Ways',
        description: 'Humorous feature article',
        publishedIn: 'The Sunday Guardian',
        publishedAt: '2013',
      },
      {
        slug: 'how-to-get-filthy-rich-in-rising-asia',
        title: 'Author Interview — Mohsin Hamid',
        description: 'How to get filthy rich in rising Asia',
        publishedIn: 'FirstCity Magazine',
        publishedAt: 'May 2013',
        thumbnail: IMG('663ee7_6d60ade8867241d09f103a71528c6d70~mv2.png'),
      },
      {
        slug: 'writers-bloc',
        title: 'Author Advaita Kala on her debut novel',
        description: 'Almost Single — an interview',
        publishedIn: 'FNL Magazine',
        publishedAt: '2009',
        thumbnail: IMG('663ee7_2fd90ab760ce47e4a425d62f1698cf2a~mv2.png'),
      },
    ],
  },

  poetry: {
    label: 'Poetry',
    blurb:
      'Published in Outlook Magazine 2022 in New Delhi, and in Abobo Zine 2023 in New York, this is a growing section of the different works to come. You can also find them directly on my Substack',
    viewMore: '/poetry',
    pieces: [
      {
        slug: 'on-writing',
        title: 'On Writing',
        thumbnail: IMG('663ee7_46d6bfab8bcc4420bbb2bb75a795988a~mv2.png'),
      },
      {
        slug: 'hannah-banana',
        title: 'Hannah Banana',
        thumbnail: IMG('663ee7_987702b503f84824a810d95918c3b38a~mv2.png'),
      },
      {
        slug: 'my-dad-socks-and-gulzar',
        title: 'My Dad, Socks & Gulzar',
        thumbnail: IMG('663ee7_4f807ce6e43a458193f2d4caaabe9359~mv2.png'),
      },
      {
        slug: 'medeas-ideas',
        title: "Medea's Ideas",
        publishedIn: 'ABOBO Zine',
        publishedAt: '2023',
      },
      {
        slug: 'home-and-hell',
        title: 'Home & Hell',
        publishedIn: 'Outlook Magazine',
        publishedAt: 'May 2022',
      },
      {
        slug: 'times-square',
        title: 'Times Square',
        publishedIn: 'Outlook Magazine',
        publishedAt: 'May 2022',
      },
      {
        slug: 'ek-sher',
        title: 'Ek Sher',
        thumbnail: '/portfolio/images/poetry--ek-sher--01.png',
      },
    ],
  },

  'published-paper': {
    label: 'Paper',
    blurb:
      'The Evolution of the Fashion Image. PAPER presented at International Design Research Symposium, 2018 at the National Institute of Design, Ahmedabad.',
    viewMore: null,
    pieces: [
      {
        slug: '',
        title: 'The Evolution of the Fashion Image',
        href: '/published-paper',
        thumbnail: IMG('663ee7_2d3cbdd7d9af4ada844a80785e538770~mv2.jpg'),
      },
    ],
  },
}

// The order to render categories on the homepage.
export const HOME_CATEGORY_ORDER = [
  'copywriting',
  'creative-direction',
  'fashion-editorial',
  'editorial',
  'poetry',
  'published-paper',
]
