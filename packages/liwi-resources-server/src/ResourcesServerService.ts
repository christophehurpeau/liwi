import type { BaseModel, Criteria, Sort } from "liwi-store";
// import ResourceServerCursor from './ResourceServerCursor';
import type { ServiceResource } from "./ServiceResource.ts";

// import { CursorResource } from './CursorResource';

export interface CreateCursorOptions<Model extends BaseModel> {
  criteria?: Criteria<Model>;
  sort?: Sort<Model>;
  limit?: number;
}

export class ResourcesServerService {
  readonly serviceResources: Map<string, ServiceResource<any, any>>;

  // readonly cursorResources: Map<string, CursorResource<any, any, any>>;

  constructor({
    serviceResources,
  }: // cursorResources = new Map(),
  {
    serviceResources: Map<string, ServiceResource<any, any>>;
    // cursorResources: Map<string, CursorResource<any, any, any>>;
  }) {
    this.serviceResources = serviceResources;
    // this.cursorResources = cursorResources;
  }

  addResource(key: string, resource: ServiceResource<any, any>): void {
    this.serviceResources.set(key, resource);
  }

  // addCursorResource(
  //   key: string,
  //   cursorResource: CursorResource<any, any, any>,
  // ) {
  //   this.cursorResources.set(key, cursorResource);
  // }

  getServiceResource(key: string): ServiceResource<any, any> {
    const resource = this.serviceResources.get(key);
    if (!resource) throw new Error(`Invalid service resource: "${key}"`);
    return resource;
  }

  // getCursorResource(key: string) {
  //   const resource = this.cursorResources.get(key);
  //   if (!resource) throw new Error(`Invalid cursor resource: "${key}"`);
  //   return resource;
  // }

  // async createCursor<Model extends BaseModel, Transformed, ConnectedUser>(
  //   resource: CursorResource<Model, Transformed, ConnectedUser>,
  //   connectedUser: ConnectedUser,
  //   { criteria, sort, limit }: CreateCursorOptions<Model>,
  // ): Promise<ResourceServerCursor<Model, any, Transformed, ConnectedUser>> {
  //   // TODO: resource.query(connectedUser, criteria || {}, sort).cursor()
  //   criteria = resource.criteria(connectedUser, criteria || {});
  //   sort = resource.sort(connectedUser, sort);
  //   const cursor = await resource.store.cursor(criteria, sort);
  //   limit = resource.limit(limit);
  //   if (limit) cursor.limit(limit);
  //   return new ResourceServerCursor(resource, cursor, connectedUser);
  // }
}
