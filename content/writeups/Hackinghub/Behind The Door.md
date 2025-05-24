---
title: Behind The Door
draft: true
tags:
  - http-smuggling
date: 2025-05-24
---
# Summary
In this challenge by [@t0xodile](https://x.com/t0xodile) - Thomas Stacey we are given the opportunity to play with a CL.0 request smuggling.
The technique is very well described, way better that I could do, on PortSwigger academy https://portswigger.net/web-security/request-smuggling/browser/cl-0 and of course in this post by the challenge author himself: https://outpost24.com/blog/http-request-smuggling-to-hijack-user-session/


# The hint

Fuzzing or whatever here wont lead you anywhere. There is a subtle hint about what has to be done in `/static/sytle.css` 

```css
* Subtle Falling Code Effect (More subtle than snowflakes) */
body::before {
    content: '01001000 01010100 01010100 01010000 00100000 01000100 01000101 01010011 01011001 01001110 01000011 00100000 01000001 01010100 01010100 01000001 01000011 01001011 01010011'; /* Example binary */
   }
[...SNIP...]
body::after {
    content: '01000010 01010010 01001111 01010111 01010011 01000101 01010010 00101101 01010000 01001111 01010111 01000101 01010010 01000101 01000100 00101110 00101110 00101110'; /* Another example */
```

The binary strings decode respectively to:

```
HTTP DESYNC ATTACKS
BROWSER-POWERED...
```

# CL.0

To understand what was happening I used the excellent Burp plugin HTTP Smuggler. A probe reveals what they call a `CL.0 desync: badsetupLF|GET /robots.txt`. In the following please note that "Update Content-Length" and "Normalize HTTP/1  line endings" are disabled. You have to account for the correct Content-Length for the smuggled request (to `/robots.txt` in this example, you will have to do for `/behind_the_door` to get the flag).

The key thing is also the single line feed in the `Foo:` header, without a carriage return (from this badsetupLF)


![[Screenshot 2025-05-24 alle 21.21.11.png]]

![[Screenshot 2025-05-24 alle 21.21.02.png]]