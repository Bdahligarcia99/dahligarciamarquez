// src/data/posts.ts
export type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  coverImageUrl?: string
  tags: string[]
  publishedAt: string // ISO
}

export const posts: Post[] = [
  {
    id: 'p1',
    title: 'Finding Voice in the Noise',
    slug: 'finding-voice-in-the-noise',
    excerpt: 'On writing through distraction and learning to listen inward.',
    content: `# Finding Voice in the Noise

This is dummy content for preview. You can replace it later.`,
    coverImageUrl: 'https://picsum.photos/seed/voice/1200/630',
    tags: ['personal', 'insight'],
    publishedAt: '2024-08-01T10:00:00Z'
  },
  {
    id: 'p2',
    title: 'Desert Storms, Quiet Houses',
    slug: 'desert-storms-quiet-houses',
    excerpt: 'Sand, memory, and why some homes keep secrets.',
    content: `# Desert Storms, Quiet Houses

Dummy post body.`,
    coverImageUrl: 'https://picsum.photos/seed/desert/1200/630',
    tags: ['personal'],
    publishedAt: '2024-08-05T09:00:00Z'
  },
  {
    id: 'p3',
    title: 'Why Stories Need Monsters',
    slug: 'why-stories-need-monsters',
    excerpt: 'A short note on fear as a compass.',
    content: `# Why Stories Need Monsters

Dummy content.`,
    coverImageUrl: 'https://picsum.photos/seed/monster/1200/630',
    tags: ['insight'],
    publishedAt: '2024-08-10T12:00:00Z'
  },
  {
    id: 'p4',
    title: 'Community is a Verb',
    slug: 'community-is-a-verb',
    excerpt: 'What I\'ve learned from sharing drafts aloud.',
    content: `# Community is a Verb

Dummy content.`,
    coverImageUrl: 'https://picsum.photos/seed/community/1200/630',
    tags: ['community'],
    publishedAt: '2024-08-12T08:00:00Z'
  },
  {
    id: 'p5',
    title: 'On Hoarding Ideas',
    slug: 'on-hoarding-ideas',
    excerpt: 'How to sort the attic of the mind.',
    content: `# On Hoarding Ideas

Dummy content.`,
    coverImageUrl: 'https://picsum.photos/seed/ideas/1200/630',
    tags: ['insight'],
    publishedAt: '2024-08-14T08:00:00Z'
  },
  {
    id: 'p6',
    title: 'A Map for the Storyteller',
    slug: 'a-map-for-the-storyteller',
    excerpt: 'Small rituals that keep me writing.',
    content: `# A Map for the Storyteller

Dummy content.`,
    coverImageUrl: 'https://picsum.photos/seed/map/1200/630',
    tags: ['personal'],
    publishedAt: '2024-08-18T08:00:00Z'
  },
  {
    id: 'p7',
    title: 'Light, Shadow, and Home',
    slug: 'light-shadow-and-home',
    excerpt: 'Why houses in fiction feel haunted.',
    content: `# Light, Shadow, and Home

Dummy content.`,
    coverImageUrl: 'https://picsum.photos/seed/light/1200/630',
    tags: ['insight', 'community'],
    publishedAt: '2024-08-20T08:00:00Z'
  },
  {
    id: 'p8',
    title: 'Notes from the Workbench',
    slug: 'notes-from-the-workbench',
    excerpt: 'Tiny lessons from building this site.',
    content: `# Notes from the Workbench

Dummy content.`,
    coverImageUrl: 'https://picsum.photos/seed/workbench/1200/630',
    tags: ['news'],
    publishedAt: '2024-08-22T08:00:00Z'
  }
]
