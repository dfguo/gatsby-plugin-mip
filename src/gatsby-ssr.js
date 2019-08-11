import React, { Fragment } from "react";
import { renderToString } from "react-dom/server";
import { Minimatch } from "minimatch";
import flattenDeep from "lodash.flattendeep";
const JSDOM = eval('require("jsdom")').JSDOM;
const minimatch = require("minimatch");

const interpolate = (str, map) =>
  str.replace(/{{\s*[\w\.]+\s*}}/g, match => map[match.replace(/[{}]/g, "")]);

const removeDuplicate = (tuple, component) => {
  let [seen, list] = tuple;
  const name = typeof component === "string" ? component : component.name;
  // if component hasn't been seen
  if (seen.indexOf(name) === -1) {
    seen.push(name);
    list.push(component);
  }
  return [seen, list];
};

// MIP doesn't allow loading of other js or json or xml
const removeScripts = x => {
  return !(
    x.type === "link" &&
    (x.props.href.match(/\.js$/) ||
      x.props.href.match(/\.json$/) ||
      x.props.href.match(/\.xml$/))
  );
};

// remove canonical if it exists
const removeCanonical = x => {
  return !(
    x.type === "link" &&
    x.props.rel === "canonical" &&
    x.props["data-mip"] !== "true"
  );
};

const removeInlineStyles = document => {
  var target = document.querySelectorAll("div");
  Array.prototype.forEach.call(target, function(element) {
    element.removeAttribute("style");
  });
  return document;
};

export const onPreRenderHTML = (
  {
    getHeadComponents,
    replaceHeadComponents,
    getPreBodyComponents,
    replacePreBodyComponents,
    getPostBodyComponents,
    replacePostBodyComponents,
    pathname
  },
  {
    statsBaidu,
    canonicalBaseUrl,
    components = [],
    includedPaths = [],
    excludedPaths = [],
    pathIdentifier = "/mip/",
    relMipHtmlPattern = "{{canonicalBaseUrl}}{{pathname}}{{pathIdentifier}}"
  }
) => {
  const headComponents = flattenDeep(getHeadComponents());
  const preBodyComponents = getPreBodyComponents();
  const postBodyComponents = getPostBodyComponents();
  const isMip = pathname && pathname.indexOf(pathIdentifier) > -1;
  if (isMip) {
    const styles = headComponents.reduce((str, x) => {
      if (x.type === "style") {
        if (x.props.dangerouslySetInnerHTML) {
          str += x.props.dangerouslySetInnerHTML.__html;
        }
      } else if (x.key && x.key === "TypographyStyle") {
        str = `${x.props.typography.toString()}${str}`;
      }
      return str;
    }, "");
    replaceHeadComponents([
      <link
        rel="stylesheet"
        type="text/css"
        href="https://c.mipcdn.com/static/v2/mip.css"
      />,
      <script async src="https://c.mipcdn.com/static/v2/mip.js" />,
      <style mip-custom="" dangerouslySetInnerHTML={{ __html: styles }} />,
      ...components.map((component, i) => {
        const name = typeof component === "string" ? component : component.name;
        return (
          <script
            key={`custom-element-${i}`}
            async
            custom-element={`${name}`}
            src={`https://c.mipcdn.com/static/v2/${name}/${name}.js`}
          />
        );
      }),
      statsBaidu !== undefined ? (
        <script
          async
          custom-element="mip-stats-baidu"
          src="https://c.mipcdn.com/static/v2/mip-stats-baidu/mip-stats-baidu.js"
        />
      ) : (
        <Fragment />
      ),
      ...headComponents
        .filter(removeCanonical)
        .filter(removeScripts)
        .filter(
          x =>
            x.type !== "style" &&
            (x.type !== "script" || x.props.type === "application/ld+json") &&
            x.key !== "TypographyStyle"
        )
    ]);
    replacePreBodyComponents([
      ...preBodyComponents.filter(x => x.key !== "plugin-google-tagmanager")
    ]);
    replacePostBodyComponents(
      postBodyComponents.filter(x => x.type !== "script")
    );
  } else if (
    (excludedPaths.length > 0 &&
      pathname &&
      excludedPaths.findIndex(_path => new Minimatch(pathname).match(_path)) <
        0) ||
    (includedPaths.length > 0 &&
      pathname &&
      includedPaths.findIndex(_path => minimatch(pathname, _path)) > -1) ||
    (excludedPaths.length === 0 && includedPaths.length === 0)
  ) {
    replaceHeadComponents([
      <link
        rel="miphtml"
        key="gatsby-plugin-mip-miphtml-link"
        href={interpolate(relMipHtmlPattern, {
          canonicalBaseUrl,
          pathIdentifier,
          pathname
        }).replace(/([^:])(\/\/+)/g, "$1/")}
      />,
      ...headComponents
    ]);
  }
};

export const onRenderBody = (
  { setHeadComponents, setHtmlAttributes, setPreBodyComponents, pathname },
  {
    statsBaidu,
    canonicalBaseUrl,
    pathIdentifier = "/mip/",
    relCanonicalPattern = "{{canonicalBaseUrl}}{{pathname}}",
    useMipClientIdApi = false
  }
) => {
  const isMip = pathname && pathname.indexOf(pathIdentifier) > -1;
  if (isMip) {
    setHtmlAttributes({ mip: "" });
    setHeadComponents([
      <link
        rel="canonical"
        data-mip="true"
        href={interpolate(relCanonicalPattern, {
          canonicalBaseUrl,
          pathname
        })
          .replace(pathIdentifier, "")
          .replace(/([^:])(\/\/+)/g, "$1/")}
      />
    ]);
    setPreBodyComponents([
      statsBaidu != undefined ? (
        <mip-stats-baidu>
          <script
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: interpolate(JSON.stringify(statsBaidu.config), {
                pathname
              })
            }}
          />
        </mip-stats-baidu>
      ) : (
        <Fragment />
      )
    ]);
  }
};

export const replaceRenderer = (
  { bodyComponent, replaceBodyHTMLString, setHeadComponents, pathname },
  { pathIdentifier = "/mip/" }
) => {
  const defaults = {
    image: {
      width: 640,
      height: 475,
      layout: "responsive"
    },
    twitter: {
      width: "390",
      height: "330",
      layout: "responsive"
    },
    iframe: {
      width: 640,
      height: 475,
      layout: "responsive"
    }
  };
  const headComponents = [];
  const isMip = pathname && pathname.indexOf(pathIdentifier) > -1;
  if (isMip) {
    const bodyHTML = renderToString(bodyComponent);
    const dom = new JSDOM(bodyHTML);
    const document = dom.window.document;

    // remove all inline styles since Baidu MIP doesn't allow inline styles
    removeInlineStyles(document);

    // convert images to mip-img or mip-anim
    const images = [].slice.call(document.getElementsByTagName("img"));
    images.forEach(image => {
      let mipImage;
      if (image.src && image.src.indexOf(".gif") > -1) {
        mipImage = document.createElement("mip-anim");
        headComponents.push({ name: "mip-anim", version: "0.1" });
      } else {
        mipImage = document.createElement("mip-img");
      }
      const attributes = Object.keys(image.attributes);
      const includedAttributes = attributes.map(key => {
        const attribute = image.attributes[key];
        mipImage.setAttribute(attribute.name, attribute.value);
        return attribute.name;
      });
      Object.keys(defaults.image).forEach(key => {
        if (includedAttributes && includedAttributes.indexOf(key) === -1) {
          mipImage.setAttribute(key, defaults.image[key]);
        }
      });
      image.parentNode.replaceChild(mipImage, image);
    });

    // convert iframes to mip-iframe
    const iframes = [].slice.call(document.getElementsByTagName("iframe"));
    iframes.forEach(iframe => {
      let mipIframe;
      let attributes;

      headComponents.push({ name: "mip-iframe", version: "0.1" });
      mipIframe = document.createElement("mip-iframe");
      attributes = Object.keys(iframe.attributes);

      const includedAttributes = attributes.map(key => {
        const attribute = iframe.attributes[key];
        mipIframe.setAttribute(attribute.name, attribute.value);
        return attribute.name;
      });
      Object.keys(defaults.iframe).forEach(key => {
        if (includedAttributes && includedAttributes.indexOf(key) === -1) {
          mipIframe.setAttribute(key, defaults.iframe[key]);
        }
      });
      iframe.parentNode.replaceChild(mipIframe, iframe);
    });
    setHeadComponents(
      Array.from(new Set(headComponents))
        .reduce(removeDuplicate, [[], []])
        .pop() // get the lsat item, which is the list
        .map((component, i) => (
          <Fragment key={`head-components-${i}`}>
            <script
              async
              custom-element={component.name}
              src={`https://c.mipcdn.com/static/v2/${component.name}/${
                component.name
              }.js`}
            />
          </Fragment>
        ))
    );
    replaceBodyHTMLString(document.body.children[0].outerHTML);
  }
};
