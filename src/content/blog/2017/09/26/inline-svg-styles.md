---
title: Inline SVG styles
category: blog
tags: [programming, web, svg, python]
date: 2017-09-26
description: A quick script to inline styles in SVGs
---

A designer gave us a set of SVG assets for a project I'm working on. Unfortunately, they each had a `<style>` tag, and each one used the same conflicting class names (`.st0`, `.st1`, `.st2`, etc). I wrote a quick python script to convert the css rules to attributes so they wouldn't conflict.

```python
from bs4 import BeautifulSoup
import tinycss
import click
css_parser = tinycss.make_parser('page3')

# Known good list of attributes that can be applied inline.
# Feel free to expand this list if need be. These were just
# the only ones we needed.
STYLE_ATTRS = (
    'fill', 'stroke', 'stroke-width', 'stroke-miterlimit',
)


def apply_styles(elem, declarations):
    for decl in declarations:
        if decl.name not in STYLE_ATTRS:
            raise ValueError(
              'unknown svg attribute: {}'.format(decl.name))
        elem.attrs[decl.name] = decl.value.as_css()


@click.command()
@click.option('--infile', default='-', type=click.File('r'))
@click.option('--outfile', default='-', type=click.File('w'))
def inline_styles(infile, outfile):
    soup = BeautifulSoup(infile.read(), 'html.parser')

    stylesheet = css_parser.parse_stylesheet(
      soup.find('style').text)
    for rule in stylesheet.rules:
        elems = soup.select(rule.selector.as_css())
        for elem in elems:
            apply_styles(elem, rule.declarations)
            elem.attrs.pop('class')

    soup.find('style').extract()

    outfile.write(soup.prettify())

if __name__ == '__main__':
    inline_styles()

```
