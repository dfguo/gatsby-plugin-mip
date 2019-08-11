# gatsby-plugin-mip

Formats Baidu MIP-specific pages by removing javascript, combining styles and adding boilerplate. Read more about Baidu MIP [here](https://www.mipengine.org/). This code is based on [gatsby-plugin-amp](https://github.com/jafaircl/gatsby-plugin-amp).

## Install

`npm install --save gatsby-plugin-mip`

## How to use

Create MIP-specific templates. Assume you have the following blog post template in `post.js`

```javascript
import React from "react";
import Img from "gatsby-image";
import Layout from "../../components/layout";

export default ({ data }) => (
  <Layout>
    <Img fluid={data.image.fluid} />
    <h1>REGULAR PAGE</h1>
    <p>regular page content</p>
  </Layout>
);
```

Create an MIP template `post.mip.js`

```javascript
import React from "react";
import Layout from "../../components/layout";

export default ({ data }) => (
  <Layout>
    <mip-img
      src-set={data.image.srcSet}
      src={data.image.src}
      width={data.image.width}
      height={data.image.height}
      alt={data.image.altText}
      layout="responsive"
    />
    <h1>MIP PAGE</h1>
    <p>mip page content</p>
  </Layout>
);
```

To assist with situations like images in markdown or other externally created HTML, the plugin will attempt to turn `img` tags to `mip-img` or `mip-anim`. While creating posts in your `gatsby-node.js` file, create an additional page in the `/mip/` directory using the MIP template you just made

```javascript
_.each(posts, (post, index) => {
  const previous = index === posts.length - 1 ? null : posts[index + 1].node;
  const next = index === 0 ? null : posts[index - 1].node;

  createPage({
    path: post.node.fields.slug,
    component: path.resolve("./src/templates/post.js"),
    context: {
      slug: post.node.fields.slug,
      previous,
      next
    }
  });

  createPage({
    path: `${post.node.fields.slug}/mip`,
    component: path.resolve("./src/templates/post.mip.js"),
    context: {
      slug: post.node.fields.slug,
      previous,
      next
    }
  });
});
```

When you build your site, you should now have pages at `/my-awesome-post/index.html` and `/my-awesome-post/mip/index.html`

Add the plugin to the plugins array in your `gatsby-config.js`

```javascript
{
  resolve: `gatsby-plugin-mip`,
  options: {
    statsBaidu: {
      config: {
        token: <baiduTrackingToken>
      }
    },
    canonicalBaseUrl: 'http://www.example.com/',
    components: [''],
    excludedPaths: ['/404*', '/'],
    pathIdentifier: '/mip/',
    relMipHtmlPattern: '{{canonicalBaseUrl}}{{pathname}}{{pathIdentifier}}',
    useMipClientIdApi: true,
  },
},
```

When your site builds, your page in the `/mip` directory should now be a valid MKIP page

## Options

**canonicalBaseUrl** `{String}`
The base URL for your site. This will be used to create a `rel="canonical"` link in your mip template and `rel="miphtml"` link in your base page.

**components** `{Array<String | Object{name<String>, version<String>}>}`
The components you will need for your MIP templates. Read more about the available components [here](https://www.mipengine.org/v2/components/index.html).

**excludedPaths**`{Array<String>}`
By default, this plugin will create `rel="miphtml"` links in all pages. If there are pages you would like to not have those links, include them here. You may use glob patterns in your strings (e.g. `/admin/*`). _this may go away if a way can be found to programatically exclude pages based on whether or not they have an MIP equivalent. But for now, this will work_

**includedPaths**`{Array<String>}`
By default, this plugin will create `rel="miphtml"` links in all pages. If, you would instead like to whitelist pages, include them here. You may use glob patterns in your strings (e.g. `/blog/*`). _this may go away if a way can be found to programatically exclude pages based on whether or not they have an MIP equivalent. But for now, this will work_

**pathIdentifier** `{String}`
The url segment which identifies MIP pages. If your regular page is at `http://www.example.com/blog/my-awesome-post` and your MIP page is at `http://www.example.com/blog/my-awesome-post/mip/`, your pathIdentifier should be `/amp/`

**relAmpHtmlPattern** `{String}`
The url pattern for your `rel="miphtml"` links. If your MIP pages follow the pattern `http://www.example.com/my-awesome-post/mip/`, the value for this should be `{{canonicalBaseUrl}}{{pathname}}{{pathIdentifier}}`.

**relCanonicalPattern** `{String}`
The url pattern for your `rel="canonical"` links. The default value is `{{canonicalBaseUrl}}{{pathname}}`.

## Caveats

The standard HTML template that Gatsby uses will cause a validation error. This is because it is missing `minimum-scale=1` in the meta viewport tag. You can create a `html.js` template file under your `src/` directory in order to override the default Gatsby one available [here](https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby/cache-dir/default-html.js). Alternatively, you can simply clone it by runnig the shell command below at the root of your project. Read more [here](https://www.gatsbyjs.org/docs/custom-html/) on customizing your `html.js`.

```shell
cp .cache/default-html.js src/html.js
```

Don't forget to update the meta viewport tag value from its initial to the required MIP value.

```html
<!-- Initial viewport meta tag -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, shrink-to-fit=no"
/>
<!-- Replacement viewport meta tag (for MIP validity) -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, minimum-scale=1, shrink-to-fit=no"
/>
```

## Automatically Converted Elements

While it is preferable to create MIP-specific templates, there may be situations where an image, iframe or some other element can't be modified. To cover these cases, the plugin will attempt to convert certain tags to their MIP equivalent.

| HTML Tag     | MIP Tag      | Status    | Issue |
| ------------ | ------------ | --------- | ----- |
| `img`        | `mip-img`    | Completed |       |
| `img (.gif)` | `mip-anim`   | Completed |       |
| `iframe`     | `mip-iframe` | Completed |       |
