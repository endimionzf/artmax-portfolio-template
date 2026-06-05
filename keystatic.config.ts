import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    blog: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'content/blog/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        date: fields.date({
          label: 'Publication Date',
          validation: { isRequired: true },
          defaultValue: { kind: 'today' },
        }),
        thumbnail: fields.image({
          label: 'Thumbnail Image',
          directory: 'public/blog',
          publicPath: '/blog/',
          validation: { isRequired: true },
        }),
        category: fields.text({
          label: 'Category',
          description: 'E.g., Audio Directing, WebGL, Workflow',
          validation: { isRequired: true },
        }),
        excerpt: fields.text({
          label: 'Excerpt',
          description: 'A brief summary of the article.',
          multiline: true,
          validation: { isRequired: true },
        }),
        content: fields.markdoc({
          label: 'Content',
          extension: 'md',
          options: {
            bold: true,
            italic: true,
            strikethrough: true,
            heading: [1, 2, 3, 4, 5, 6],
            blockquote: true,
            orderedList: true,
            unorderedList: true,
            table: true,
            link: true,
            divider: true,
            codeBlock: true,
            image: {
              directory: 'public/blog',
              publicPath: '/blog/',
            },
          },
        }),
      },
    }),
  },
});
