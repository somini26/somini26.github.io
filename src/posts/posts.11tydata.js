export default {
  layout: "post.njk",
  eleventyComputed: {
    permalink: (data) => (data.draft ? false : `/posts/${data.page.fileSlug}/`),
  },
};
