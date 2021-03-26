FROM hayd/alpine-deno:1.8.2

COPY ./main.ts /main.ts

RUN deno --unstable cache /main.ts

CMD [ "run", "--unstable", "--allow-env", "--allow-run", "/main.ts" ]
