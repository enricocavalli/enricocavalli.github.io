---
title: Crypto Failures Official writup
draft: false
tags:
  - encryption
date: 2025-03-03
---
The initial idea of this room was to have the player deduce the algorithm and block mode of operation without source code. In the following we present a possible way to think without the source code.

We are facing a web site that gives us a strange message that seems to hint at crypt

![[300049238-eec52c4f-ca03-4030-b4df-1e9f61a2237b.png]]

and weird cookies:

```
GET / HTTP/1.1
Host: localhost

Set-Cookie: secure_cookie=Te7UluXR4LR3ATeo.p3pQFAq1oTen3mFG2VSPZoTeC4tei%2FJuyPYTeO13yB1gVmewTem72E6sCBBB2Te59ztFoFSBP6TeVperfvtHA4cTevj4rstdJ7JgTei2lckp7DuP.TeahMtYvXQSHgTeEY09wundjQ.TeTSTUPdWiqZoTeY.b0cNIgKHgTe4LXyy5IBlxMTeKPKPPSF2ocMTeFf26FImUMQcTeNvb2c5b6ULYTeyQ3phzYcCaATecAGDOTQWv8YTe7ug%2Fq%2FxM5CkTeCEBuhQSZ1wMTeA3XnWSDmy.ITeFW3zjVhs0VUTePNV1wxSZ7esTe.azfs4H0ULoTeL6yDfhI9zaYTeZ1wtA6jtQeYTempSzrEThRdATe3Plrzr7wa0MTee1vMt3C8aKQTedpQL6S18lFwTeJupt2v.O8v2TehWUOwHw4kM6TeJNVSktT0wQ6; expires=Fri, 26 Jan 2024 17:42:49 GMT; Max-Age=3600; path=/
Set-Cookie: user=guest; expires=Fri, 26 Jan 2024 17:42:49 GMT; Max-Age=3600; path=/
```

Here `crypt`  refers to the function related to DES encryption (an ancient way to "hash" passwords in shadow file on Unix systems: https://en.wikipedia.org/wiki/Crypt_(C)

Playing with headers of the http request, it's easy to see that the cookie and the printed message are related to the `User-Agent`: using `User-Agent: A` we get a sensibly shorter cookie.

```bash
curl -i  -H 'User-Agent: A' http://localhost

HTTP/1.1 302 Found
Date: Fri, 26 Jan 2024 16:57:42 GMT
Server: Apache/2.4.57 (Debian)
X-Powered-By: PHP/8.3.2
Set-Cookie: secure_cookie=8eYkyzJDNKfAQ8eOA.OkF%2FqMLM8ez5PWgXpNfCE8eR7CGERO4Vro8evTQyHoQV.ek8e22ePZzEaE%2Fg8efy0RH7g2E1.8e1g26wE9K5L.8eaq0NvRtoRCc8eJBzBEoo4eyU8egaIH7MEr1BQ8e4DtysHobtNY8eY56aX0PXmGo8ehic8JQhI4nU8eEkN4vfJCGXs8ejBcMhfV84AQ8e89uAgNOG4WE8eu4e00vErpjs8e2aR2roD5fMo8ebcuD6d.6o3Y8eRi0EXN8dRO2; expires=Fri, 26 Jan 2024 17:57:42 GMT; Max-Age=3600; path=/
Set-Cookie: user=guest; expires=Fri, 26 Jan 2024 17:57:42 GMT; Max-Age=3600; path=/
Location: /
Content-Length: 0
Content-Type: text/html; charset=UTF-8
```

If we try to change `user=admin` of course we get an error because that information is also encrypted at the start of the `secure_cookie` that probably is the encryption of

```
username:User-Agent:some_very_long_secret_key
```

Since crypt works on 8 characters at a time, and transforms them in a sequence of 13 characters (including the salt at the start), there must be some block mode in operation. Let's see if we can deduce something using a long sequence of `A`s:

```bash
curl -i  http://localhost  -H 'User-Agent: '`python3 -c "print('A'*32)"`
HTTP/1.1 302 Found
Date: Sat, 27 Jan 2024 13:17:46 GMT
Server: Apache/2.4.57 (Debian)
X-Powered-By: PHP/8.3.2
Set-Cookie: secure_cookie=RzZBYI02dQWfgRzFZ32e8OznWoRzFZ32e8OznWoRzFZ32e8OznWoRz7yT2AEOLolQRzPzIPEjR3MsIRzuG6PA7j0IVURzwxoqgvhXlSsRzEO7x2sfeXfARznnVZX3uGGNIRzd1bHpMOezi2RzYdSSe2rhCA6Rz9dOdZzmeFiwRzcnNlkke6.aIRzCu9SNdJWPowRzJkw6DKJzBasRzef7OJaFBzDQRzvSvruxCoJp6Rzuo2BuG6450wRzv6EdxpNljwwRzxoxEgwqS5j.RzELe8V08KBZ2RzRGvJa%2FbieDQRzleVZHKVUpWURzS4J9yCAvgsY; expires=Sat, 27 Jan 2024 14:17:46 GMT; Max-Age=3600; path=/
Set-Cookie: user=guest; expires=Sat, 27 Jan 2024 14:17:46 GMT; Max-Age=3600; path=/
```

Splitting the output at the salt (`Rz` in our case) we get:

```
RzZBYI02dQWfg
RzFZ32e8OznWo
RzFZ32e8OznWo
RzFZ32e8OznWo
Rz7yT2AEOLolQ
...
```
this clearly indicates that blocks of 8 repeating `A`s are encrypted to `RzFZ32e8OznWo`. We can confirm this theory with john the ripper (and a wordlist consisting of the single word `AAAAAAAA`), or with php:

```php
php > echo crypt('AAAAAAAA','Rz');
RzFZ32e8OznWo
```

We now know that encryption works with 8 characters blocks in ECB mode (every block is encrypted indipendently - see https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation) . Since username is at the beginning of the encrypted string we can simply use a `User-Agent` consisting of `AA`: by doing this the encrypted block will be the encryption of `guest:AA`.

```bash
curl -i http://localhost -H 'User-Agent: AA'
HTTP/1.1 302 Found
Date: Sat, 27 Jan 2024 13:34:42 GMT
Server: Apache/2.4.57 (Debian)
X-Powered-By: PHP/8.3.2
Set-Cookie: secure_cookie=6PYYkdB3efx8o6PyCdZZiBOONg6Pk58ih1Kx9V.6PYg12ixWuWN26Ps2o9EanzsBY6P3b1i2xtMpIc6P9pso8fJxJC26P%2FfN.vtADZRg6PSZhjNgmImCo6P79gWJQMSkjo6PJIQawGoftQw6POVF8ZJEiYUY6PwieibKTd.Fs6PfFw5k4Rk%2FdQ6PXYD%2FctFedd.6Poshk0hw98Mo6PhtY1VLewk%2Fg6PtB7IsELpAho6PlKAMEKVMHJY6Pk0hAmCDvbeM6PjjBikmnVjIY; expires=Sat, 27 Jan 2024 14:34:42 GMT; Max-Age=3600; path=/
Set-Cookie: user=guest; expires=Sat, 27 Jan 2024 14:34:42 GMT; Max-Age=3600; path=/
```

Now we can do a chosen plaintext attack considering the first block `6PYYkdB3efx8o6` that is the encryption of `guest:AA` and substituting it with the encryption of `admin:AA`

```php
php > echo crypt('guest:AA','6P');
6PYYkdB3efx8o
php > echo crypt('admin:AA','6P');
6PH.Q3gcSJ6R.
```

so that we get first flag:

```bash
curl -i http://localhost \
> -H 'Cookie: user=admin; secure_cookie=6PH.Q3gcSJ6R.6PyCdZZiBOONg6Pk58ih1Kx9V.6PYg12ixWuWN26Ps2o9EanzsBY6P3b1i2xtMpIc6P9pso8fJxJC26P/fN.vtADZRg6PSZhjNgmImCo6P79gWJQMSkjo6PJIQawGoftQw6POVF8ZJEiYUY6PwieibKTd.Fs6PfFw5k4Rk/dQ6PXYD/ctFedd.6Poshk0hw98Mo6PhtY1VLewk/g6PtB7IsELpAho6PlKAMEKVMHJY6Pk0hAmCDvbeM6PjjBikmnVjIY' \
> -H 'User-Agent: AA'
HTTP/1.1 200 OK
Date: Sat, 27 Jan 2024 13:39:41 GMT
Server: Apache/2.4.57 (Debian)
X-Powered-By: PHP/8.3.2
Content-Length: 65
Content-Type: text/html; charset=UTF-8

congrats: THM{***********}. Now I want the key
```

But how to get the key which is a very long string appended after `username:User-Agent:...` ? We can start by increasing the length of our user agent until the cookie length increments by 13 characters: at that precise moment it means that overall length of `username:User-Agent:secret_key` does not fit any more into N blocks, but it fits in N+1 blocks. And, most importantly, last block will consist of just a single character: last character of our secret key. Let's do an example:

```bash
curl -s -i http://localhost -H 'User-Agent: AA' | grep secure_cookie |  cut -f2 -d= | cut -f1 -d ';'| sed -e 's!%2F!/!gi'  | tr -d '\n' |  wc -c
     273
curl -s -i http://localhost -H 'User-Agent: AAA'| grep secure_cookie |  cut -f2 -d= | cut -f1 -d ';'| sed -e 's!%2F!/!gi'  | tr -d '\n' |  wc -c
     273
# ...
curl -s -i http://localhost -H 'User-Agent: AAAAAAAA'| grep secure_cookie |  cut -f2 -d= | cut -f1 -d ';'| sed -e 's!%2F!/!gi'  | tr -d '\n' |  wc -c
     286
 ```

So by using `AAAAAAAA` we get one more encrypted block: (273/13=21 blocks, 286/13=22 blocks). This means that last block will be the encryption of **`secret_key`'s last character**:

```bash
curl -s -i http://localhost -H 'User-Agent: AAAAAAAA'
HTTP/1.1 302 Found
Date: Sat, 27 Jan 2024 14:00:47 GMT
Server: Apache/2.4.57 (Debian)
X-Powered-By: PHP/8.3.2
Set-Cookie: secure_cookie=Kw...KwjvAKdvx1p9s; expires=Sat, 27 Jan 2024 15:00:47 GMT; Max-Age=3600; path=/
```

Is `KwjvAKdvx1p9s` the encryption of `}` with salt `Kw`? Yes:

```php
php > echo crypt('}','Kw');
KwjvAKdvx1p9s
```

Incrementing User-Agent length by one character, now last block will be the encryption of last two characters of the secret_key (and we already know the last character), so we can easily determine the other one. We can proceed in this way and get all 8 last characters of secret key. Adjusting the algorithm to find the entire key is left as an exercise to the reader :)

Just kidding. Here is a possible python implementation to solve the problem (you could run it with python3 up to version 3.12 since `crypt` was deprecated in python 3.13). If you don't wont to mess with multiple python versions you can just use docker:

```bash
docker pull python:3.12
docker run -it -v $PWD:/host --rm python:3.12 bash
```


```python
#!/usr/bin/env python3

import requests
import crypt

import urllib.parse

requests.packages.urllib3.disable_warnings()


url = 'http://localhost'

session = requests.Session()
session.verify=False
# session.proxies= {"http":"http://127.0.0.1:8080"}

def make_cookie(str,salt):
    ret=''
    blocks=len(str)//8+1
    for i in range(blocks):
        ret+=crypt.crypt( str[8*i:8*(i+1)], salt )
    return(ret)

def get_cookie(agent):
    response = session.get(url, headers={'User-Agent': agent}, allow_redirects=False)
    securecookie=session.cookies.get_dict()['secure_cookie']
    session.cookies.clear()
    return(urllib.parse.unquote(securecookie))


def find_char(cookie,key):
    salt=cookie[0:2]
    m=len(key)//8
    l=len(cookie)
    for n in range(33,127):
        if(crypt.crypt(chr(n)+key,salt)==cookie[l-13*(m+1):l-13*m]):
            return(chr(n))
            break
    return None


def find_next(agent,key):
    str=''
    while str=='':
        v=get_cookie(agent)
        if (char := find_char(v,key)) is not None:
            str+=char
        agent+='A'
    return(agent,str)

key=''
agent='a'


while len(key)==0 or key[0]!=':':
    agent,prev=find_next(agent,key)
    key=prev+key

key=key[1:]
cookie_string='admin:A:' + key
print(key)
cookie=make_cookie(cookie_string,'00')


my_headers = {"Cookie":"user=admin; secure_cookie=" + cookie , "User-Agent": "A"}
print(my_headers)


r=session.get(url,headers=my_headers)
print(r.text)
```
