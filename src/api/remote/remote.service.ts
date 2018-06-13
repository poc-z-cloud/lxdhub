import { RemoteDto, ResponseDto } from '@lxdhub/common';
import { Inject } from '@nestjs/common';

import { RemoteFactory } from './factories';
import { RemoteRepository } from './remote.repository';

/**
 * Interface between the Database and API for
 * Remote operations.
 */
export class RemoteService {
    /**
     * Initializes the RemoteService.
     */
    constructor(
        private remoteFactory: RemoteFactory,
        @Inject('RemoteRepository')
        private remoteRepository: RemoteRepository
    ) { }

    /**
     * Returns all remotes and
     * transforms the database remotes into data-transfer-objects
     */
    async findAll(): Promise<ResponseDto<RemoteDto[]>> {
        const [remotes, total] = await this.remoteRepository.findAll();
        return new ResponseDto<RemoteDto[]>(
            this.remoteFactory.entitiesToDto(remotes));
    }
}