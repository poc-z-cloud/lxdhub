import { Test } from '@nestjs/testing';
import { plainToClass } from 'class-transformer';

import { PaginationOptionsDto } from '../common';
import { ImageAvailabilityService } from '../image-availability/image-availability.service';
import { LXDService } from '../lxd/lxd.service';
import { RemoteRepository } from '../remote/remote.repository';
import { SearchDictionary, SearchService } from '../search';
import { ImageDetailFactory, ImageListItemFactory } from './factories';
import { ImageRepository } from './image.repository';
import { ImageService } from './image.service';
import { RemoteService } from '../remote';

const searchDitionary: SearchDictionary[] = [
    {
        aliases: [
            ''
        ],
        searchLiteralKey: ''
    }
];

class SearchServiceMock {
    getLiteral(query: string, dictionaries: SearchDictionary[], key?: string) {
        return null;
    }
}

class RemoteRepositoryMock {
    findOneItem() { }
}

class LXDServiceMock {
    async cloneImage() { }
}

class ImageAvailabilityServiceMock {
    getOrCreate() { }
}

const remoteServiceMock = () => ({
    findByName: () => ({ id: 1 }),
    findById: id => ({ id })
});

/**
 * Test cases for the image service
 */
describe('ImageService', () => {
    let imageService: ImageService;
    let imageListItemFactory: ImageListItemFactory;
    let imageRepository: ImageRepository;
    let remoteRepository: RemoteRepository;
    let imageDetailFactory: ImageDetailFactory;
    let lxdService: LXDService;
    let imageAvailabilityService: ImageAvailabilityService;
    let remoteService: RemoteService;

    const remoteName = 'my-remote';
    const remoteId = 1;
    const images = [{
        fingerprint: 'fingerprint1',
        description: 'desc1',
        uploadedAt: new Date(),
        id: 1
    }, {
        fingerprint: 'fingerprint2',
        description: 'desc2',
        uploadedAt: new Date(),
        id: 2
    }];

    beforeEach(async done => {
        // Mock Image Module
        const module = await Test.createTestingModule({
            providers: [
                ImageService,
                {
                    provide: 'ImageRepositoryRepository',
                    useClass: ImageRepository
                },
                ImageListItemFactory,
                ImageDetailFactory,
                { provide: RemoteService, useFactory: remoteServiceMock },
                {
                    provide: SearchService,
                    useClass: SearchServiceMock
                },
                {
                    provide: 'ImageSearchDictionary',
                    useFactory: () => searchDitionary
                },
                {
                    provide: 'RemoteRepositoryRepository',
                    useClass: RemoteRepositoryMock
                },
                {
                    provide: 'LXDService',
                    useClass: LXDServiceMock
                },
                {
                    provide: 'ImageAvailabilityService',
                    useClass: ImageAvailabilityServiceMock
                }
            ]
        }).compile();

        // Get the imageService in the Testing Module Context
        imageListItemFactory = module.get<ImageListItemFactory>(ImageListItemFactory);
        imageDetailFactory = module.get<ImageDetailFactory>(ImageDetailFactory);
        imageRepository = module.get<ImageRepository>('ImageRepositoryRepository');
        remoteRepository = module.get<RemoteRepository>('RemoteRepositoryRepository');
        lxdService = module.get<LXDService>(LXDService);
        imageAvailabilityService = module.get<ImageAvailabilityService>(ImageAvailabilityService);
        imageService = module.get<ImageService>(ImageService);
        remoteService = module.get<RemoteService>(RemoteService);
        done();
    });

    describe('findByRemote', () => {
        it('should return ImageListItem', async () => {
            jest.spyOn(imageRepository, 'findByRemote').mockImplementation(() => [images, images.length]);
            jest.spyOn(imageListItemFactory, 'entitiesToDto').mockImplementation(() => images);
            jest.spyOn(remoteService, 'findByName').mockReturnValue({ id: 1, name: remoteName });

            // Convert to PagintaionOptionsDto
            // with using the class-validator validation
            const options = plainToClass(PaginationOptionsDto, { limit: 2, offset: 0 });
            expect(await imageService.findByRemote(remoteName, options)).toEqual({
                results: images,
                offset: 0,
                limit: 2,
                total: images.length,
            });
        });

        it('should call ImageRepository correctly without search-query-string', async () => {
            jest.spyOn(imageRepository, 'findByRemote').mockImplementation(() => []);
            jest.spyOn(imageListItemFactory, 'entitiesToDto').mockImplementation(() => []);
            jest.spyOn(remoteService, 'findByName').mockImplementation(name => ({ id: remoteId, name }));

            // Convert to PagintaionOptionsDto
            // with using the class-validator validation
            const options = plainToClass(PaginationOptionsDto, { limit: 2, offset: 0 });
            await imageService.findByRemote(remoteName, options);
            expect(remoteService.findByName).toHaveBeenCalledWith(remoteName);
            expect(imageRepository.findByRemote).toHaveBeenCalledWith(remoteId, options, {});
        });
    });

    describe('findOne', () => {
        /**
         * Image service should return one image and
         * wrap it in a Result
         */
        it('should return image detail', async () => {
            const result = {
                fingerprint: 'fingerprint1'
            };

            const imageRepositoryMock = jest.spyOn(imageRepository, 'findOneByFingerprint').mockImplementation(() => result);
            const imageDetailFactoryMock = jest.spyOn(imageDetailFactory, 'entityToDto').mockImplementation(() => result);

            expect(await imageService.findOne(1)).toEqual({ results: result });
            // Expect mock to be called once each
            expect(imageDetailFactoryMock.mock.calls.length).toBe(1);
            expect(imageRepositoryMock.mock.calls.length).toBe(1);
        });

        /**
         * When no image was found, throw an error
         */
        it('should throw an exception if no image is found', async () => {
            jest.spyOn(imageRepository, 'findOneItem')
                .mockImplementation(() => undefined);

            // workaround for async error catching
            // https://github.com/facebook/jest/issues/1377
            try {
                await imageService.findOne(-1);
            }
            catch (err) {
                expect(() => { throw err; }).toThrowError();
            }
        });

    });

    describe('cloneImage', () => {
        beforeEach(() => {
            jest.spyOn(lxdService, 'cloneImage').mockImplementation(() => null);
            jest.spyOn(remoteRepository, 'findOneItem').mockImplementation(id => ({ id }));
            jest.spyOn(imageRepository, 'findOneItem').mockImplementation(() => ({ id: 1 }));
            jest.spyOn(imageAvailabilityService, 'getOrCreate').mockImplementation(() => ({ id: 1 }));
            jest.spyOn(imageService, 'findOne').mockImplementation(() => ({ id: 1 }));
        });

        it('should call lxcservice correctly', async () => {
            await imageService.cloneImage(1, { sourceRemoteId: 2, destinationRemoteId: 3 });
            expect(lxdService.cloneImage).toHaveBeenCalledWith({ id: 1 }, { id: 2 }, { id: 3 });
        });

        it('should throw an error, when no image is found', async () => {
            jest.spyOn(imageRepository, 'findOneItem').mockImplementation(() => null);
            imageService.cloneImage(1, { sourceRemoteId: 2, destinationRemoteId: 3 })
                .catch(err => expect(err).toBeDefined());
        });

        it('should throw an error, when no sourceremote is found', async () => {
            jest.spyOn(remoteRepository, 'findOneItem').mockImplementation(() => null);
            imageService.cloneImage(1, { sourceRemoteId: 2, destinationRemoteId: 3 })
                .catch(err => expect(err).toBeDefined());
        });

        it('should throw an error, when no desitinationremote is found', async () => {
            jest.spyOn(remoteRepository, 'findOneItem').mockImplementation((id) => id === 3 ? null : {});
            imageService.cloneImage(1, { sourceRemoteId: 2, destinationRemoteId: 3 })
                .catch(err => expect(err).toBeDefined());
        });
    });

});
