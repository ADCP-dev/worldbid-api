FROM node:22.16.0-alpine

RUN apk add --no-cache bash
RUN npm i -g @nestjs/cli typescript ts-node

COPY package*.json /tmp/app/
RUN cd /tmp/app && npm install --legacy-peer-deps

COPY . /usr/src/app
RUN cp -a /tmp/app/node_modules /usr/src/app
COPY ./startup.sh /opt/startup.sh
RUN chmod +x /opt/startup.sh
RUN sed -i 's/\r//g' /opt/startup.sh

WORKDIR /usr/src/app
RUN echo "" > .env
RUN npm run build

EXPOSE 3000
CMD ["/opt/startup.sh"]
