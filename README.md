### Multinetwork Auth API

#### Part of [multinetwork project](https://github.com/jym272/multinetwork-k8s)

#### This project needs an `.env` file in the root directory with the following:

```dotenv
PORT=3051
POSTGRES_USER=jorge
POSTGRES_DB=auth
POSTGRES_PASSWORD=123456
POSTGRES_HOST=localhost
POSTGRES_PORT=5234
PASSWORD_PEPPER=XeDRMzq9HpuWL2ZYBw2BDi1sxjT5dnOSdOFEU00wvpo=
JWT_SECRET=Q5nT18OkUuHam/Y5BRbzY3SYlwNqpJRdvYVwS/gzecc=
```

#### Environments

There is a github `testing` environment that is used for testing the project in the
workflow `run-test.yml`, It has two secrets:

- `PASSWORD_PEPPER`
- `JWT_SECRET`

To generate a strong `JWT_TOKEN` or `PASSWORD_PEPPER` use one of the following commands:

```bash
openssl rand -base64 32
head -c 32 /dev/urandom | base64
```
