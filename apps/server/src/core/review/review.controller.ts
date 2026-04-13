import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { PageAccessService } from '../page/page-access/page-access.service';
import {
  CreateReviewDto,
  ChangeReviewStatusDto,
  AddReviewCommentDto,
  CreateReviewAnchorDto,
  DeleteReviewAnchorDto,
  UpdateReviewAssigneesDto,
  ReviewIdDto,
  ReviewPageIdDto,
  AssignedReviewsDto,
} from './dto/review.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@manadocs/db/pagination/pagination-options';
import { User, Workspace } from '@manadocs/db/types/entity.types';
import { PageRepo } from '@manadocs/db/repos/page/page.repo';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAccessService: PageAccessService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateReviewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return this.reviewService.create(
      { page, workspaceId: workspace.id, user },
      dto,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async findByPageId(
    @Body() dto: ReviewPageIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return this.reviewService.findByPageId(dto.pageId, pagination, dto.status);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async findById(@Body() dto: ReviewIdDto, @AuthUser() user: User) {
    const review = await this.reviewService.findById(dto.reviewId);

    if (review.pageId) {
      const page = await this.pageRepo.findById(review.pageId);
      if (page) {
        await this.pageAccessService.validateCanView(page, user);
      }
    }

    const histories = await this.reviewService.findHistoriesByReviewId(
      review.id,
    );

    return { ...review, histories };
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-status')
  async changeStatus(
    @Body() dto: ChangeReviewStatusDto,
    @AuthUser() user: User,
  ) {
    return this.reviewService.changeStatus(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('add-comment')
  async addComment(
    @Body() dto: AddReviewCommentDto,
    @AuthUser() user: User,
  ) {
    return this.reviewService.addComment(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create-anchor')
  async createAnchor(
    @Body() dto: CreateReviewAnchorDto,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanEdit(page, user);

    return this.reviewService.createAnchor(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete-anchor')
  async deleteAnchor(
    @Body() dto: DeleteReviewAnchorDto,
    @AuthUser() user: User,
  ) {
    return this.reviewService.deleteAnchor(dto.anchorId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-assignees')
  async updateAssignees(
    @Body() dto: UpdateReviewAssigneesDto,
    @AuthUser() user: User,
  ) {
    return this.reviewService.updateAssignees(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('assigned')
  async findAssigned(
    @Body() dto: AssignedReviewsDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    return this.reviewService.findAssignedToUser(
      user,
      dto.statuses ?? ['open', 'progress'],
      pagination,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('anchors')
  async findAnchorsByPageId(
    @Body() dto: ReviewPageIdDto,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return this.reviewService.findAnchorsByPageId(dto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteReview(
    @Body() dto: ReviewIdDto,
    @AuthUser() user: User,
  ) {
    const review = await this.reviewService.findById(dto.reviewId);

    if (review.pageId) {
      const page = await this.pageRepo.findById(review.pageId);
      if (page) {
        const ability = await this.spaceAbility.createForUser(
          user,
          page.spaceId,
        );
        if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
          throw new ForbiddenException();
        }
      }
    }

    await this.reviewService.deleteReview(dto.reviewId);
  }
}
