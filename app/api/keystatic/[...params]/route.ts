import { makeRouteHandler } from '@keystatic/next/route-handler';
import config from '../../../../keystatic.config';

const { GET: keystaticGET, POST: keystaticPOST } = makeRouteHandler({ config });

const cleanRequest = (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
    return new Request(url.toString(), req);
  }
  return req;
};

export const GET = async (req: Request) => keystaticGET(cleanRequest(req));
export const POST = async (req: Request) => keystaticPOST(cleanRequest(req));

export const dynamic = 'force-dynamic';
